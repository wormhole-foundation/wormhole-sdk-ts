import { BN, IdlAccounts, Program } from '@coral-xyz/anchor';
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
  ChainId,
  ChainsConfig,
  Network,
  Ntt,
  NttManagerMessage,
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
import { utils } from '@wormhole-foundation/sdk-solana-core';
import type { NativeTokenTransfer } from './anchor-idl/index.js';
import { idl } from './anchor-idl/index.js';
import { nttAddresses } from './utils.js';

interface NttContracts {
  manager: string;
  transceiver: {
    wormhole?: string;
  };
}

export type Config = IdlAccounts<NativeTokenTransfer>['config'];
export type InboxItem = IdlAccounts<NativeTokenTransfer>['inboxItem'];
export interface TransferArgs {
  amount: BN;
  recipientChain: { id: ChainId };
  recipientAddress: number[];
  shouldQueue: boolean;
}

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

    // TODO: probably wrong
    const senderAddress = new SolanaAddress(sender).unwrap();
    const from = senderAddress;
    const fromAuthority = senderAddress;

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
      from: from,
      fromAuthority: fromAuthority,
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
      senderAddress,
      this.pdas.sessionAuthority(fromAuthority, transferArgs),
      fromAuthority,
      amount,
    );

    const tx = new Transaction();
    tx.add(approveIx, transferIx, releaseIx);

    yield this.createUnsignedTx(
      { transaction: tx, signers: [outboxItem] },
      'Ntt.Transfer',
    );
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
        sessionAuthority: this.pdas.sessionAuthority(
          args.fromAuthority,
          args.transferArgs,
        ),
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

  async *redeem(attestations: Ntt.Attestation[], payer: AccountAddress<C>) {
    if (attestations.length === this.xcvrs.length) throw 'No';

    const config = await this.getConfig();

    // TODO: not this
    const wormholeNTT = attestations[0]! as WormholeNttTransceiver.VAA;
    // @ts-ignore
    const nttMessage = wormholeNTT.payload
      .nttManagerPayload as NttManagerMessage<any>;

    const senderAddress = new SolanaAddress(payer).unwrap();

    // Here we create a transaction with three instructions:
    // 1. receive wormhole messsage (vaa)
    // 1. redeem
    // 2. releaseInboundMint or releaseInboundUnlock (depending on mode)
    //
    // The first instruction verifies the VAA.
    // The second instruction places the transfer in the inbox, then the third instruction
    // releases it.
    //
    // In case the redeemed amount exceeds the remaining inbound rate limit capacity,
    // the transaction gets delayed. If this happens, the second instruction will not actually
    // be able to release the transfer yet.
    // To make sure the transaction still succeeds, we set revertOnDelay to false, which will
    // just make the second instruction a no-op in case the transfer is delayed.

    const tx = new Transaction();
    tx.add(
      await this.createReceiveWormholeMessageInstruction(
        senderAddress,
        wormholeNTT,
      ),
    );
    tx.add(await this.createRedeemInstruction(senderAddress, wormholeNTT));

    const releaseArgs = {
      payer: senderAddress,
      nttMessage,
      recipient: new PublicKey(
        // @ts-ignore
        nttMessage.payload.recipientAddress.toUint8Array(),
      ),
      chain: this.chain,
      revertOnDelay: false,
      config: config,
    };

    const releaseIx = await (config.mode.locking != null
      ? this.createReleaseInboundUnlockInstruction(releaseArgs)
      : this.createReleaseInboundMintInstruction(releaseArgs));
    tx.add(releaseIx);

    yield this.createUnsignedTx({ transaction: tx, signers: [] }, 'Ntt.Redeem');
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
        // TODO: why?
        // @ts-ignore
        inboxItem: this.pdas.inboxItemAccount(emitterChain, nttMessage),
        inboxRateLimit,
        outboxRateLimit: this.pdas.outboxRateLimitAccount(),
      })
      .instruction();
  }

  // TODO: document that if recipient is provided, then the instruction can be
  // created before the inbox item is created (i.e. they can be put in the same tx)
  async createReleaseInboundMintInstruction(args: {
    payer: PublicKey;
    chain: Chain;
    nttMessage: NttManagerMessage;
    revertOnDelay: boolean;
    recipient?: PublicKey;
    config?: Config;
  }): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const recipientAddress =
      args.recipient ??
      (await this.getInboxItem(args.chain, args.nttMessage)).recipientAddress;

    return await this.program.methods
      .releaseInboundMint({
        revertOnDelay: args.revertOnDelay,
      })
      .accounts({
        common: {
          payer: args.payer,
          config: { config: this.pdas.configAccount() },
          inboxItem: this.pdas.inboxItemAccount(args.chain, args.nttMessage),
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
    nttMessage: NttManagerMessage;
    revertOnDelay: boolean;
    recipient?: PublicKey;
    config?: Config;
  }): Promise<TransactionInstruction> {
    const config = await this.getConfig();
    if (config.paused) throw new Error('Contract is paused');

    const recipientAddress =
      args.recipient ??
      (await this.getInboxItem(args.chain, args.nttMessage)).recipientAddress;

    return await this.program.methods
      .releaseInboundUnlock({
        revertOnDelay: args.revertOnDelay,
      })
      .accounts({
        common: {
          payer: args.payer,
          config: { config: this.pdas.configAccount() },
          inboxItem: this.pdas.inboxItemAccount(args.chain, args.nttMessage),
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

  getCurrentOutboundCapacity(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getCurrentInboundCapacity(fromChain: Chain): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getInboundQueuedTransfer(
    transceiverMessage: string,
    fromChain: Chain,
  ): Promise<Ntt.InboundQueuedTransfer | undefined> {
    throw new Error('Method not implemented.');
  }
  completeInboundQueuedTransfer(
    transceiverMessage: string,
    token: TokenAddress<C>,
    fromChain: Chain,
    payer: string,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async getInboxItem(
    chain: Chain,
    nttMessage: NttManagerMessage,
  ): Promise<InboxItem> {
    return await this.program.account.inboxItem.fetch(
      this.pdas.inboxItemAccount(chain, nttMessage),
    );
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
