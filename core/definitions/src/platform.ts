import { Chain, Network, Platform, PlatformToChains, ProtocolName } from "@wormhole-foundation/sdk-base";
import { WormholeMessageId } from "./attestation";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { Balances, ChainsConfig, TokenAddress, SignedTx, TokenId, TxHash } from "./types";
import { ProtocolInitializer } from "./protocol";

export interface PlatformUtils<N extends Network, P extends Platform> {

  Platform(): P

  // Initialize a new PlatformContext object
  setConfig(network: N, config?: ChainsConfig<N, P>): PlatformContext<N, P>;

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
  isNativeTokenId<C extends PlatformToChains<P>>(chain: C, tokenId: TokenId<C>): boolean;

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
  getCurrentBlock(rpc: RpcConnection<P>): Promise<number>;

  // Platform interaction utils
  sendWait<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    stxns: SignedTx[],
  ): Promise<TxHash[]>;

}

export interface PlatformContext<N extends Network, P extends Platform> {
  readonly network: N;
  readonly platform: P;
  readonly config: ChainsConfig<N, P>;


  // Create a new Chain context object
  getChain<C extends PlatformToChains<P>>(chain: C): ChainContext<N, C, P>;

  // Create a _new_ RPC Connection
  getRpc<C extends PlatformToChains<P>>(chain: C): RpcConnection<P>;

  // Get a protocol name
  // Note this overlaps with PlatformUtils.getProtocol
  getProtocol<PN extends ProtocolName, T>(protocol: PN, rpc: RpcConnection<P>): Promise<T>;

  // Look up transaction logs and parse out Wormhole messages
  parseTransaction<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]>;

}
