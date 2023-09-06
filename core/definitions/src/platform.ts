import { PlatformName, ChainName } from "@wormhole-foundation/sdk-base";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { ChainsConfig, TokenId, TxHash } from "./types";
import { WormholeMessageId } from "./attestation";
import { SignedTx } from "./types";
// protocols
import { TokenBridge, AutomaticTokenBridge } from "./protocols/tokenBridge";
import { CircleBridge, AutomaticCircleBridge } from "./protocols/cctp";
import { WormholeCore } from "./protocols/core";
import { NativeAddress } from "./address";

export type PlatformCtr<P extends PlatformName> = {
  _platform: P;
  new (conf: ChainsConfig): Platform<P>;
};

// Force passing RPC connection so we don't create a new one with every fn call
export interface Platform<P extends PlatformName> {
  readonly platform: P;
  readonly conf: ChainsConfig;
  // Utils for platform specific queries
  getDecimals(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId | "native"
  ): Promise<bigint>;
  getBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId | "native"
  ): Promise<bigint | null>;

  //
  getChain(chain: ChainName): ChainContext<P>;
  getRpc(chain: ChainName): RpcConnection<P>;

  // protocol clients
  getWormholeCore(rpc: RpcConnection<P>): Promise<WormholeCore<P>>;
  getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>>;
  getAutomaticTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticTokenBridge<P>>;
  getAutomaticCircleBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>>;
  getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>>;

  // Platform interaction utils
  sendWait(rpc: RpcConnection<P>, stxns: SignedTx[]): Promise<TxHash[]>;
  parseTransaction(
    chain: ChainName,
    rpc: RpcConnection<P>,
    txid: TxHash
  ): Promise<WormholeMessageId[]>;
  parseAddress(chain: ChainName, address: string): NativeAddress<P>;
}
