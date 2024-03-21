import { BN, IdlAccounts, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import type { NativeTokenTransfer } from './anchor-idl/index.js';
import { idl } from './anchor-idl/index.js';
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
  encoding,
  toChainId,
  tokens,
} from '@wormhole-foundation/sdk-connect';
import {
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
import { ChainId } from '@wormhole-foundation/sdk-connect';

interface NttContracts {
  manager: string;
  transceiver: {
    wormhole?: string;
  };
}

type Seed = Uint8Array | string;
export function derivePda(
  seeds: Seed | readonly Seed[],
  programId: PublicKeyInitData,
) {
  const toBytes = (s: string | Uint8Array) =>
    typeof s === 'string' ? encoding.bytes.encode(s) : s;
  return PublicKey.findProgramAddressSync(
    Array.isArray(seeds) ? seeds.map(toBytes) : [toBytes(seeds as Seed)],
    new PublicKey(programId),
  )[0];
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

    this.xcvrs = [new SolanaNttWormholeTransceiver<N, C>(this, '')];
  }

  private derivePda(seeds: Parameters<typeof derivePda>[0]): PublicKey {
    return derivePda(seeds, this.program.programId);
  }

  configAccountAddress(): PublicKey {
    return this.derivePda('config');
  }

  outboxRateLimitAccountAddress(): PublicKey {
    return this.derivePda('outbox_rate_limit');
  }

  inboxRateLimitAccountAddress(chain: Chain): PublicKey {
    const chainId = toChainId(chain);
    return this.derivePda([
      'inbox_rate_limit',
      encoding.bignum.toBytes(chainId),
    ]);
  }

  /**
   * Fetches the Config account from the contract.
   *
   * @param config If provided, the config is just returned without making a
   *               network request. This is handy in case multiple config
   *               accessor functions are used, the config can just be queried
   *               once and passed around.
   */
  async getConfig(): Promise<Config> {
    return await this.program.account.config.fetch(this.configAccountAddress());
  }

  async *transfer(
    sender: AccountAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    queue: boolean,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    throw new Error('Method not implemented.');
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
