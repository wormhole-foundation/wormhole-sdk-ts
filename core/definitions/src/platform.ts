import {
  Chain,
  Network,
  Platform,
  PlatformToChains,
  ProtocolName,
} from "@wormhole-foundation/sdk-base";
import { WormholeMessageId } from "./attestation";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { TokenAddress } from "./address";
import { Balances, ChainsConfig, SignedTx, TokenId, TxHash } from "./types";
import { ProtocolInitializer } from "./protocol";

// PlatformUtils represents the _static_ attributes available on
// the PlatformContext Class
export interface PlatformUtils<N extends Network, P extends Platform> {
  // Value for the Platform so we can access it at runtime
  _platform: P;

  // Initialize a new PlatformContext object
  new (network: N, config?: ChainsConfig<N, P>): PlatformContext<N, P>;

  // Get a protocol name
  getProtocolInitializer<PN extends ProtocolName>(protocol: PN): ProtocolInitializer<P, PN>;

  // Check if this chain is supported by this platform
  // Note: purposely not adding generic parameters
  isSupportedChain(chain: Chain): boolean;

  // Look up a Chain from its native chain ID
  // See implementation for details
  // Note: this is _not_ the same as the Wormhole chain id
  chainFromChainId(chainId: string | bigint): [Network, Chain];

  // Given an RPC connection, request the native chain id
  // then resolve it to a Wormhole Canonical network and chain name
  chainFromRpc(rpc: RpcConnection<P>): Promise<[Network, Chain]>;

  // Get the native (gas) token id for a given chain
  nativeTokenId<C extends PlatformToChains<P>>(chain: C): TokenId<C>;
  isNativeTokenId<C extends PlatformToChains<P>>(chain: C, tokenId: TokenId): boolean;

  // Get the number of decimals for a given token
  getDecimals<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    token: TokenAddress<C>,
  ): Promise<bigint>;

  // Get the balance of a token for a given wallet address
  getBalance<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenAddress<C>,
  ): Promise<bigint | null>;
  // Look up the balances for a list of tokens for a given wallet address
  // TODO: this should be batched but isn't currently
  getBalances<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    walletAddress: string,
    tokens: TokenAddress<C>[],
  ): Promise<Balances>;

  // Look up the latest block
  getLatestBlock(rpc: RpcConnection<P>): Promise<number>;
  getLatestFinalizedBlock(rpc: RpcConnection<P>): Promise<number>;

  // Send a set of signed transactions over RPC and wait for
  // them to be accepted and confirmed
  // Note: this does not mean the transaction is _final_
  sendWait<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    stxns: SignedTx[],
  ): Promise<TxHash[]>;
}

// PlatformContext is an instance of the class that represents a specific Platform
export abstract class PlatformContext<N extends Network, P extends Platform> {
  constructor(
    readonly network: N,
    readonly config: ChainsConfig<N, P>,
  ) {}

  // Create a _new_ RPC Connection
  abstract getRpc<C extends PlatformToChains<P>>(chain: C): RpcConnection<P>;

  // Create a new Chain context object
  abstract getChain<C extends PlatformToChains<P>>(chain: C): ChainContext<N, P, C>;

  // Create a new Protocol Client instance by protocol name
  abstract getProtocol<PN extends ProtocolName, T>(protocol: PN, rpc: RpcConnection<P>): Promise<T>;

  // Look up transaction logs and parse out Wormhole messages
  abstract parseTransaction<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]>;
}
