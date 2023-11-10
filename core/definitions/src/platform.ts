import { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import { WormholeMessageId } from "./attestation";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { AnyAddress, Balances, ChainsConfig, SignedTx, TokenId, TxHash } from "./types";

export interface PlatformUtils<P extends Platform> {
  // Get the native (gas) token id for a given chain
  nativeTokenId(chain: Chain): TokenId;
  isNativeTokenId(chain: Chain, tokenId: TokenId): boolean;

  // Check if this chain is supported by this platform
  isSupportedChain(chain: Chain): boolean;

  // Get the number of decimals for a given token
  getDecimals(chain: Chain, rpc: RpcConnection<P>, token: AnyAddress): Promise<bigint>;
  // Get the balance of a token for a given wallet address
  getBalance(
    chain: Chain,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: AnyAddress,
  ): Promise<bigint | null>;
  // Look up the balances for a list of tokens for a given wallet address
  // TODO: this should be batched but isn't currently
  getBalances(
    chain: Chain,
    rpc: RpcConnection<P>,
    walletAddress: string,
    tokens: AnyAddress[],
  ): Promise<Balances>;
  // Look up the latest block
  getCurrentBlock(rpc: RpcConnection<P>): Promise<number>;

  // Platform interaction utils
  sendWait(chain: Chain, rpc: RpcConnection<P>, stxns: SignedTx[]): Promise<TxHash[]>;

  // Look up a Chain from its native chain ID
  // See implementation for details
  // Note: this is _not_ the same as the Wormhole chain id
  chainFromChainId(chainId: string): [Network, Chain];

  // Given an RPC connection, request the native chain id
  // then resolve it to a Wormhole Canonical network and chain name
  chainFromRpc(rpc: RpcConnection<P>): Promise<[Network, Chain]>;
}

// Force passing RPC connection so we don't create a new one with every fn call
export interface Platform<P extends Platform> extends PlatformUtils<P> {
  readonly platform: P;
  readonly config: ChainsConfig;
  readonly network: Network;

  // update the config for this platform
  setConfig(network: Network, _config?: ChainsConfig): Platform<P>;

  // Create a new Chain context object
  getChain(chain: Chain): ChainContext<P>;

  // Create a _new_ RPC Connection
  getRpc(chain: Chain): RpcConnection<P>;

  // Look up transaction logs and parse out Wormhole messages
  parseTransaction(
    chain: Chain,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]>;
}
