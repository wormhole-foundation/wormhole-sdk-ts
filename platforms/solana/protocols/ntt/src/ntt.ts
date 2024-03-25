import { IdlAccounts, Program } from '@coral-xyz/anchor';
import * as splToken from '@solana/spl-token';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainsConfig,
  Network,
  Ntt,
  NttTransceiver,
  ProtocolInitializer,
  TokenAddress,
  UnsignedTransaction,
  WormholeNttTransceiver,
  toChain,
  toChainId,
  tokens,
} from '@wormhole-foundation/sdk-connect';
import {
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
import {
  SolanaWormholeCore,
  utils,
} from '@wormhole-foundation/sdk-solana-core';
import BN from 'bn.js';
import type { NativeTokenTransfer } from './anchor-idl/index.js';
import { idl } from './anchor-idl/index.js';
import { TransferArgs, nttAddresses } from './utils.js';
import { NativeAddress } from '@wormhole-foundation/sdk-connect';

interface NttContracts {
  manager: string;
  transceiver: {
    wormhole?: string;
  };
}

export type Config = IdlAccounts<NativeTokenTransfer>['config'];
export type InboxItem = IdlAccounts<NativeTokenTransfer>['inboxItem'];

export function solanaNttProtocolFactory(
  token: string,
): ProtocolInitializer<'Solana', 'Ntt'> {
  class _SolanaNtt<N extends Network, C extends SolanaChains> extends SolanaNtt<
    N,
    C
  > {
    tokenAddress: string = token;

    static async fromRpc<N extends Network>(
      provider: Connection,
      config: ChainsConfig<N, SolanaPlatformType>,
    ): Promise<_SolanaNtt<N, SolanaChains>> {
      const [network, chain] = await SolanaPlatform.chainFromRpc(provider);
      const conf = config[chain]!;

      if (conf.network !== network)
        throw new Error(`Network mismatch: ${conf.network} != ${network}`);
      if (!conf.tokenMap) throw new Error('Token map not found');

      const maybeToken = tokens.filters.byAddress(conf.tokenMap, token);
      if (maybeToken === undefined) throw new Error('Token not found');
      if (!maybeToken.ntt) throw new Error('Token not configured with NTT');

      const { manager, transceiver } = maybeToken.ntt;
      return new _SolanaNtt(
        network as N,
        chain,
        provider,
        conf.contracts.coreBridge!,
        {
          manager,
          transceiver: { wormhole: transceiver },
        },
      );
    }
  }
  return _SolanaNtt;
}

export class SolanaNttWormholeTransceiver<
  N extends Network,
  C extends SolanaChains,
> implements NttTransceiver<N, C, WormholeNttTransceiver.VAA>
{
  constructor(
    readonly manager: SolanaNtt<N, C>,
    readonly address: string,
  ) {
    //
  }

  async *receive(
    attestation: WormholeNttTransceiver.VAA,
    sender?: AccountAddress<C> | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    throw new Error('Method not implemented.');
  }
}

export class SolanaNtt<N extends Network, C extends SolanaChains>
  implements Ntt<N, C>
{
  core: SolanaWormholeCore<N, C>;
  xcvrs: SolanaNttWormholeTransceiver<N, C>[];
  program: Program<NativeTokenTransfer>;
  pdas: ReturnType<typeof nttAddresses>;

  config?: Config;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly wormholeId: string,
    readonly contracts: NttContracts,
  ) {
    this.program = new Program<NativeTokenTransfer>(
      // @ts-ignore
      idl.ntt,
      this.contracts.manager,
      { connection },
    );

    this.core = new SolanaWormholeCore<N, C>(network, chain, connection, {
      coreBridge: wormholeId,
    });

    this.pdas = nttAddresses(this.program.programId);
    this.xcvrs = [new SolanaNttWormholeTransceiver<N, C>(this, '')];
  }

  async getConfig(): Promise<Config> {
    this.config =
      this.config ??
      (await this.program.account.config.fetch(this.pdas.configAccount()));
    return this.config;
  }

  async *transfer(
    sender: AccountAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    queue: boolean,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    const config: Config = await this.getConfig();

    const outboxItem = Keypair.generate();

    const senderAddress = new SolanaAddress(sender).unwrap();
    const fromAuthority = senderAddress;
    const from = getAssociatedTokenAddressSync(config.mint, fromAuthority);

    const transferArgs: TransferArgs = {
      amount: new BN(amount.toString()),
      recipientChain: { id: toChainId(destination.chain) },
      recipientAddress: Array.from(
        destination.address.toUniversalAddress().toUint8Array(),
      ),
      shouldQueue: queue,
    };

    const txArgs = {
      transferArgs,
      payer: senderAddress,
      from,
      fromAuthority,
      outboxItem: outboxItem.publicKey,
      config,
    };

    const transferIx: TransactionInstruction = await (config.mode.locking !=
    null
      ? this.createTransferLockInstruction(txArgs)
      : this.createTransferBurnInstruction(txArgs));

    const releaseIx: TransactionInstruction =
      await this.createReleaseOutboundInstruction({
        payer: senderAddress,
        outboxItem: outboxItem.publicKey,
        revertOnDelay: !queue,
      });

    const approveIx = splToken.createApproveInstruction(
      from,
      this.pdas.sessionAuthority(fromAuthority, transferArgs),
      fromAuthority,
      amount,
    );

    const tx = new Transaction();
    tx.feePayer = senderAddress;
    tx.add(approveIx, transferIx, releaseIx);

    yield this.createUnsignedTx(
      { transaction: tx, signers: [outboxItem] },
      'Ntt.Transfer',
    );
  }

  async *redeem(attestations: Ntt.Attestation[], payer: AccountAddress<C>) {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    if (attestations.length !== this.xcvrs.length) throw 'No';
    // TODO: not this, we should iterate over the set of enabled xcvrs?
    const wormholeNTT = attestations[0]! as WormholeNttTransceiver.VAA;

    // Post the VAA that we intend to redeem
    yield* this.core.postVaa(payer, wormholeNTT);

    const senderAddress = new SolanaAddress(payer).unwrap();

    const nttMessage = wormholeNTT.payload.nttManagerPayload;
    const emitterChain = wormholeNTT.emitterChain;

    const releaseArgs = {
      payer: senderAddress,
      config,
      nttMessage,
      recipient: new PublicKey(
        nttMessage.payload.recipientAddress.toUint8Array(),
      ),
      chain: emitterChain,
      revertOnDelay: false,
    };

    const tx = new Transaction();
    tx.feePayer = senderAddress;
    tx.add(
      await this.createReceiveWormholeMessageInstruction(
        senderAddress,
        wormholeNTT,
      ),
    );
    tx.add(await this.createRedeemInstruction(senderAddress, wormholeNTT));

    tx.add(
      await (config.mode.locking != null
        ? this.createReleaseInboundUnlockInstruction(releaseArgs)
        : this.createReleaseInboundMintInstruction(releaseArgs)),
    );

    yield this.createUnsignedTx({ transaction: tx }, 'Ntt.Redeem');
  }

  async getCurrentOutboundCapacity(): Promise<bigint> {
    const rl = await this.program.account.outboxRateLimit.fetch(
      this.pdas.outboxRateLimitAccount(),
    );
    return BigInt(rl.rateLimit.capacityAtLastTx.toString());
  }

  async getCurrentInboundCapacity(fromChain: Chain): Promise<bigint> {
    const rl = await this.program.account.inboxRateLimit.fetch(
      this.pdas.inboxRateLimitAccount(fromChain),
    );
    return BigInt(rl.rateLimit.capacityAtLastTx.toString());
  }

  async *completeInboundQueuedTransfer(
    fromChain: Chain,
    transceiverMessage: Ntt.Message,
    token: TokenAddress<C>,
    payer: AccountAddress<C>,
  ) {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const senderAddress = new SolanaAddress(payer).unwrap();
    const tx = new Transaction();
    tx.feePayer = senderAddress;
    const releaseArgs = {
      payer: senderAddress,
      config,
      nttMessage: transceiverMessage,
      recipient: new PublicKey(
        transceiverMessage.payload.recipientAddress.toUint8Array(),
      ),
      chain: fromChain,
      revertOnDelay: false,
    };

    tx.add(
      await (config.mode.locking != null
        ? this.createReleaseInboundUnlockInstruction(releaseArgs)
        : this.createReleaseInboundMintInstruction(releaseArgs)),
    );

    yield this.createUnsignedTx(
      { transaction: tx },
      'Ntt.CompleteInboundTransfer',
    );
  }

  async getInboundQueuedTransfer(
    chain: Chain,
    nttMessage: Ntt.Message,
  ): Promise<Ntt.InboundQueuedTransfer<C> | null> {
    const inboxItem = await this.program.account.inboxItem.fetch(
      this.pdas.inboxItemAccount(chain, nttMessage),
    );
    if (!inboxItem) return null;

    const { recipientAddress, amount, releaseStatus } = inboxItem!;
    const rateLimitExpiry = releaseStatus.releaseAfter
      ? releaseStatus.releaseAfter[0].toNumber()
      : 0;

    const xfer: Ntt.InboundQueuedTransfer<C> = {
      recipient: new SolanaAddress(recipientAddress) as NativeAddress<C>,
      amount: BigInt(amount.toString()),
      rateLimitExpiryTimestamp: rateLimitExpiry,
    };

    return xfer;
  }

  async createTransferLockInstruction(args: {
    transferArgs: TransferArgs;
    payer: PublicKey;
    from: PublicKey;
    fromAuthority: PublicKey;
    outboxItem: PublicKey;
    config?: Config;
  }): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const sessionAuthority = this.pdas.sessionAuthority(
      args.fromAuthority,
      args.transferArgs,
    );

    const recipientChain = toChain(args.transferArgs.recipientChain.id);
    return await this.program.methods
      .transferLock(args.transferArgs)
      .accounts({
        common: {
          payer: args.payer,
          config: { config: this.pdas.configAccount() },
          mint: config.mint,
          from: args.from,
          tokenProgram: config.tokenProgram,
          outboxItem: args.outboxItem,
          outboxRateLimit: this.pdas.outboxRateLimitAccount(),
        },
        peer: this.pdas.peerAccount(recipientChain),
        inboxRateLimit: this.pdas.inboxRateLimitAccount(recipientChain),
        custody: config.custody,
        sessionAuthority: sessionAuthority,
      })
      .instruction();
  }

  async createTransferBurnInstruction(args: {
    transferArgs: TransferArgs;
    payer: PublicKey;
    from: PublicKey;
    fromAuthority: PublicKey;
    outboxItem: PublicKey;
    config?: Config;
  }): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const recipientChain = toChain(args.transferArgs.recipientChain.id);
    return await this.program.methods
      .transferBurn(args.transferArgs)
      .accounts({
        common: {
          payer: args.payer,
          config: { config: this.pdas.configAccount() },
          mint: config.mint,
          from: args.from,
          outboxItem: args.outboxItem,
          outboxRateLimit: this.pdas.outboxRateLimitAccount(),
        },
        peer: this.pdas.peerAccount(recipientChain),
        inboxRateLimit: this.pdas.inboxRateLimitAccount(recipientChain),
        sessionAuthority: this.pdas.sessionAuthority(
          args.fromAuthority,
          args.transferArgs,
        ),
      })
      .instruction();
  }

  async createReleaseOutboundInstruction(args: {
    payer: PublicKey;
    outboxItem: PublicKey;
    revertOnDelay: boolean;
  }): Promise<TransactionInstruction> {
    const whAccs = utils.getWormholeDerivedAccounts(
      this.program.programId,
      this.wormholeId,
    );

    return await this.program.methods
      .releaseWormholeOutbound({
        revertOnDelay: args.revertOnDelay,
      })
      .accounts({
        payer: args.payer,
        config: { config: this.pdas.configAccount() },
        outboxItem: args.outboxItem,
        wormholeMessage: this.pdas.wormholeMessageAccount(args.outboxItem),
        emitter: whAccs.wormholeEmitter,
        transceiver: this.pdas.registeredTransceiver(this.program.programId),
        wormhole: {
          bridge: whAccs.wormholeBridge,
          feeCollector: whAccs.wormholeFeeCollector,
          sequence: whAccs.wormholeSequence,
          program: this.wormholeId,
        },
      })
      .instruction();
  }

  async createReceiveWormholeMessageInstruction(
    payer: PublicKey,
    wormholeNTT: WormholeNttTransceiver.VAA,
  ): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const nttMessage = wormholeNTT.payload.nttManagerPayload;
    const emitterChain = wormholeNTT.emitterChain;
    return await this.program.methods
      .receiveWormholeMessage()
      .accounts({
        payer: payer,
        config: { config: this.pdas.configAccount() },
        peer: this.pdas.transceiverPeerAccount(emitterChain),
        vaa: utils.derivePostedVaaKey(
          this.wormholeId,
          Buffer.from(wormholeNTT.hash),
        ),
        transceiverMessage: this.pdas.transceiverMessageAccount(
          emitterChain,
          nttMessage.id,
        ),
      })
      .instruction();
  }

  async createRedeemInstruction(
    payer: PublicKey,
    wormholeNTT: WormholeNttTransceiver.VAA,
  ): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const nttMessage = wormholeNTT.payload.nttManagerPayload;
    const emitterChain = wormholeNTT.emitterChain;

    const nttManagerPeer = this.pdas.peerAccount(emitterChain);
    const inboxRateLimit = this.pdas.inboxRateLimitAccount(emitterChain);
    const inboxItem = this.pdas.inboxItemAccount(emitterChain, nttMessage);

    return await this.program.methods
      .redeem({})
      .accounts({
        payer: payer,
        config: this.pdas.configAccount(),
        peer: nttManagerPeer,
        transceiverMessage: this.pdas.transceiverMessageAccount(
          emitterChain,
          nttMessage.id,
        ),
        transceiver: this.pdas.registeredTransceiver(this.program.programId),
        mint: config.mint,
        inboxItem,
        inboxRateLimit,
        outboxRateLimit: this.pdas.outboxRateLimitAccount(),
      })
      .instruction();
  }

  async createReleaseInboundMintInstruction(args: {
    payer: PublicKey;
    chain: Chain;
    nttMessage: Ntt.Message;
    revertOnDelay: boolean;
    recipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const inboxItem = this.pdas.inboxItemAccount(args.chain, args.nttMessage);

    const recipientAddress =
      args.recipient ??
      (await this.getInboundQueuedTransfer(
        args.chain,
        args.nttMessage,
      ))!.recipient
        .toNative(this.chain)
        .unwrap();

    return await this.program.methods
      .releaseInboundMint({
        revertOnDelay: args.revertOnDelay,
      })
      .accounts({
        common: {
          payer: args.payer,
          config: { config: this.pdas.configAccount() },
          inboxItem,
          recipient: getAssociatedTokenAddressSync(
            config.mint,
            recipientAddress,
          ),
          mint: config.mint,
          tokenAuthority: this.pdas.tokenAuthority(),
        },
      })
      .instruction();
  }

  async createReleaseInboundUnlockInstruction(args: {
    payer: PublicKey;
    chain: Chain;
    nttMessage: Ntt.Message;
    revertOnDelay: boolean;
    recipient?: PublicKey;
  }): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const recipientAddress =
      args.recipient ??
      (await this.getInboundQueuedTransfer(
        args.chain,
        args.nttMessage,
      ))!.recipient
        .toNative(this.chain)
        .unwrap();

    const inboxItem = this.pdas.inboxItemAccount(args.chain, args.nttMessage);
    console.log('Inbox Item', inboxItem.toBase58());

    return await this.program.methods
      .releaseInboundUnlock({
        revertOnDelay: args.revertOnDelay,
      })
      .accounts({
        common: {
          payer: args.payer,
          config: { config: this.pdas.configAccount() },
          inboxItem: inboxItem,
          recipient: getAssociatedTokenAddressSync(
            config.mint,
            recipientAddress,
          ),
          mint: config.mint,
          tokenAuthority: this.pdas.tokenAuthority(),
        },
        custody: config.custody,
      })
      .instruction();
  }
  createUnsignedTx(
    txReq: SolanaTransaction,
    description: string,
    parallelizable: boolean = false,
  ): SolanaUnsignedTransaction<N, C> {
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
