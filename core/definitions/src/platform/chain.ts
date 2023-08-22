import { ChainName, Network, PlatformName } from "@wormhole-foundation/sdk-base";
import { Platform } from "./platform";
import { SignedTxn, TxHash, OmitChain } from "./types";
import { TokenBridge } from "../protocolInterfaces/tokenBridge";

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;
  getConnection(): any;
  sendWait(stxns: SignedTxn[]): Promise<TxHash[]>;
  getTokenBridge(): Promise<TokenBridge<PlatformName>>;

  // TODO: can we add these automatically?
  getForeignAsset: OmitChain<Platform['getForeignAsset']>;
  getTokenDecimals: OmitChain<Platform['getTokenDecimals']>;
  getNativeBalance: OmitChain<Platform['getNativeBalance']>;
  getTokenBalance: OmitChain<Platform['getTokenBalance']>;
  parseTransaction: OmitChain<Platform['parseTransaction']>;
}

export type ChainCtr = new () => ChainContext;