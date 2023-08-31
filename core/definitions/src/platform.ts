import { PlatformName, ChainName } from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "./universalAddress";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { ChainsConfig, TokenId, TxHash } from "./types";
import { WormholeMessageId } from "./attestation";
import { SignedTxn } from "./types";
// protocols
import { TokenBridge, AutomaticTokenBridge } from "./protocols/tokenBridge";
import { CircleBridge, AutomaticCircleBridge } from "./protocols/cctp";

export type PlatformCtr<P extends PlatformName> = {
  _platform: P;
  new (conf: ChainsConfig): Platform<P>;
};

// Force passing RPC connection so we don't create a new one with every fn call
export interface Platform<P extends PlatformName> {
  readonly platform: P;
  readonly conf: ChainsConfig;
  // Utils for platform specific queries
  getWrappedAsset(
    chain: ChainName,
    rpc: RpcConnection<P>,
    tokenId: TokenId
  ): Promise<TokenId | null>;
  getTokenDecimals(rpc: RpcConnection<P>, token: TokenId): Promise<bigint>;
  getNativeBalance(rpc: RpcConnection<P>, walletAddr: string): Promise<bigint>;
  getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId
  ): Promise<bigint | null>;

  //
  getChain(chain: ChainName): ChainContext<P>;
  getRpc(chain: ChainName): RpcConnection<P>;

  // protocol clients
  getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>>;
  getAutomaticTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticTokenBridge<P>>;
  getAutomaticCircleBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>>;
  getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>>;

  // Platform interaction utils
  sendWait(rpc: RpcConnection<P>, stxns: SignedTxn[]): Promise<TxHash[]>;
  parseTransaction(
    chain: ChainName,
    rpc: RpcConnection<P>,
    txid: TxHash
  ): Promise<WormholeMessageId[]>;
  parseAddress(address: string): UniversalAddress;
}
