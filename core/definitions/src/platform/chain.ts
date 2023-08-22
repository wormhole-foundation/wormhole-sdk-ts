import { ChainName, Network, PlatformName } from "@wormhole-foundation/sdk-base";
import { Platform } from "./platform";
import { RpcConnection, SignedTxn, TxHash, OmitChainRpc } from "./types";
import { TokenBridge } from "../protocolInterfaces/tokenBridge/tokenBridge";

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;
  getRPC(): RpcConnection;
  sendWait(stxns: SignedTxn[]): Promise<TxHash[]>;
  getTokenBridge(): Promise<TokenBridge<PlatformName>>;

  // TODO: can we add these automatically?
  getForeignAsset: OmitChainRpc<Platform['getForeignAsset']>;
  getTokenDecimals: OmitChainRpc<Platform['getTokenDecimals']>;
  getNativeBalance: OmitChainRpc<Platform['getNativeBalance']>;
  getTokenBalance: OmitChainRpc<Platform['getTokenBalance']>;
  parseTransaction: OmitChainRpc<Platform['parseTransaction']>;
}

export type ChainCtr = new () => ChainContext;