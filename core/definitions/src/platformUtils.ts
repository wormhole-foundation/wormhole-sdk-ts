import { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";
import { WormholeMessageId } from "./attestation";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { Balances, ChainsConfig, TokenAddress, SignedTx, TokenId, TxHash } from "./types";

export interface PlatformUtils<N extends Network, P extends Platform> {
  readonly network: N;
  readonly platform: P;
  readonly config: ChainsConfig<N, P>;

  // update the config for this platform
  setConfig<N extends Network>(network: N, _config?: ChainsConfig<N, P>): PlatformUtils<N, P>;

  // Create a new Chain context object
  getChain<C extends PlatformToChains<P>>(chain: C): ChainContext<N, C>;

  // Create a _new_ RPC Connection
  getRpc<C extends PlatformToChains<P>>(chain: C): RpcConnection<P>;

  // Look up transaction logs and parse out Wormhole messages
  parseTransaction<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]>;

  // Get the native (gas) token id for a given chain
  nativeTokenId<C extends PlatformToChains<P>>(chain: C): TokenId<C>;
  isNativeTokenId<C extends PlatformToChains<P>>(chain: C, tokenId: TokenId<C>): boolean;

  // Check if this chain is supported by this platform
  // Note: purposely not adding generic parameters
  isSupportedChain(chain: Chain): boolean;

  // Get the number of decimals for a given token
  getDecimals<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    token: TokenAddress<P>,
  ): Promise<bigint>;
  // Get the balance of a token for a given wallet address
  getBalance<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenAddress<P>,
  ): Promise<bigint | null>;
  // Look up the balances for a list of tokens for a given wallet address
  // TODO: this should be batched but isn't currently
  getBalances<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    walletAddress: string,
    tokens: TokenAddress<P>[],
  ): Promise<Balances>;
  // Look up the latest block
  getCurrentBlock(rpc: RpcConnection<P>): Promise<number>;

  // Platform interaction utils
  sendWait<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    stxns: SignedTx[],
  ): Promise<TxHash[]>;

  // Look up a Chain from its native chain ID
  // See implementation for details
  // Note: this is _not_ the same as the Wormhole chain id
  chainFromChainId(chainId: string | bigint): [Network, Chain];

  // Given an RPC connection, request the native chain id
  // then resolve it to a Wormhole Canonical network and chain name
  chainFromRpc(rpc: RpcConnection<P>): Promise<[Network, Chain]>;
}
