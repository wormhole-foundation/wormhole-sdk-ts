import { ChainName, Network } from "@wormhole-foundation/sdk-base";
import { Platform } from "./platform";
import { RpcConnection } from "./rpc";

// This requires the arguments in the function definition come in the same order
// [chain], [rpc], ...

type OmitChain<Fn> = Fn extends (chain: ChainName, ...args: infer P) => infer R
  ? (...args: P) => R
  : Fn;
type OmitRpc<Fn> = Fn extends (rpc: RpcConnection, ...args: infer P) => infer R
  ? (...args: P) => R
  : Fn;

type OmitChainRpc<Fn> = OmitRpc<OmitChain<Fn>>;

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;
  getRpc(): RpcConnection;

  // TODO: can we add these automatically?
  getForeignAsset: OmitChainRpc<Platform["getForeignAsset"]>;
  getTokenDecimals: OmitChainRpc<Platform["getTokenDecimals"]>;
  getNativeBalance: OmitChainRpc<Platform["getNativeBalance"]>;
  getTokenBalance: OmitChainRpc<Platform["getTokenBalance"]>;
  parseTransaction: OmitChainRpc<Platform["parseTransaction"]>;

  //
  sendWait: OmitChainRpc<Platform["sendWait"]>;

  // protocols
  getTokenBridge: OmitChainRpc<Platform["getTokenBridge"]>;
  getAutomaticTokenBridge: OmitChainRpc<Platform["getAutomaticTokenBridge"]>;
  getCircleRelayer: OmitChainRpc<Platform["getCircleRelayer"]>;
  getCircleBridge: OmitChainRpc<Platform["getCircleBridge"]>;
}
