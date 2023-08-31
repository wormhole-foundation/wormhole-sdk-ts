import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { Platform } from "./platform";
import { RpcConnection } from "./rpc";
import { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge";
import { AutomaticCircleBridge, CircleBridge } from "./protocols/cctp";

// This requires the arguments in the function definition come in the same order
// [chain], [rpc], ...

type OmitChain<Fn> = Fn extends (chain: ChainName, ...args: infer P) => infer R
  ? (...args: P) => R
  : Fn;
type OmitRpc<Fn> = Fn extends (rpc: RpcConnection, ...args: infer P) => infer R
  ? (...args: P) => R
  : Fn;

type OmitChainRpc<Fn> = OmitRpc<OmitChain<Fn>>;

export abstract class ChainContext<P extends PlatformName> {
  // Cached objects
  protected tokenBridge?: TokenBridge<"Evm">;
  protected autoTokenBridge?: AutomaticTokenBridge<"Evm">;
  protected circleBridge?: CircleBridge<"Evm">;
  protected autoCircleBridge?: AutomaticCircleBridge<"Evm">;

  constructor(readonly platform: Platform<P>, readonly chain: ChainName) {}

  abstract getRpc(): RpcConnection;

  getForeignAsset: OmitChainRpc<Platform<P>["getForeignAsset"]> = (token) => {
    return this.platform.getForeignAsset(this.chain, this.getRpc(), token);
  };

  getTokenDecimals: OmitChainRpc<Platform<P>["getTokenDecimals"]> = (
    tokenAddr
  ) => {
    return this.platform.getTokenDecimals(this.getRpc(), tokenAddr);
  };

  getNativeBalance: OmitChainRpc<Platform<P>["getNativeBalance"]> = (
    walletAddress
  ) => {
    return this.platform.getNativeBalance(this.getRpc(), walletAddress);
  };

  getTokenBalance: OmitChainRpc<Platform<P>["getTokenBalance"]> = (
    walletAddr,
    tokenId
  ) => {
    return this.platform.getTokenBalance(
      this.chain,
      this.getRpc(),
      walletAddr,
      tokenId
    );
  };

  parseTransaction: OmitChainRpc<Platform<P>["parseTransaction"]> = (txid) => {
    return this.platform.parseTransaction(this.chain, this.getRpc(), txid);
  };

  sendWait: OmitChainRpc<Platform<P>["sendWait"]> = (stxns) => {
    return this.platform.sendWait(this.getRpc(), stxns);
  };

  // protocols
  getTokenBridge: OmitChainRpc<Platform<P>["getTokenBridge"]> = async () => {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRpc());
    return this.tokenBridge;
  };

  getAutomaticTokenBridge: OmitChainRpc<
    Platform<P>["getAutomaticTokenBridge"]
  > = async () => {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getAutomaticTokenBridge(this.getRpc());
    return this.autoTokenBridge;
  };

  getCircleBridge: OmitChainRpc<Platform<P>["getCircleBridge"]> = async () => {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getCircleBridge(this.getRpc());
    return this.circleBridge;
  };

  getAutomaticCircleBridge: OmitChainRpc<
    Platform<P>["getAutomaticCircleBridge"]
  > = async () => {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getAutomaticCircleBridge(this.getRpc());
    return this.autoCircleBridge;
  };
}
