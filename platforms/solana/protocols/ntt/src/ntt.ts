import * as splToken from '@solana/spl-token';
import { BN, IdlAccounts, Program } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
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
  NttTransceiver,
  ProtocolInitializer,
  TokenAddress,
  UnsignedTransaction,
  WormholeNttTransceiver,
  tokens,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import {
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
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
      return new _SolanaNtt(network as N, chain, provider, {
        manager,
        transceiver: { wormhole: transceiver },
      });
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

    const senderAddress = new SolanaAddress(sender).unwrap();
    const outboxItem = Keypair.generate();

    const fromAuthority = senderAddress;

    const txArgs = {
      payer: senderAddress,
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

    const transferArgs: TransferArgs = {
      amount: new BN(amount.toString()),
      recipientChain: { id: toChainId(destination.chain) },
      recipientAddress: Array.from(
        destination.address.toUniversalAddress().toUint8Array(),
      ),
      shouldQueue: queue,
    };

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

  async *redeem(
    attestations: any[],
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    if (attestations.length === this.xcvrs.length) throw 'No';
    throw new Error('Method not implemented.');
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
