import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { Platform } from "./platform";
import { RpcConnection } from "./rpc";
import { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge";
import { AutomaticCircleBridge, CircleBridge } from "./protocols/cctp";

// This requires the arguments in the function definition come in the same order
// [chain], [rpc], ...

type OmitChain<Fn> = Fn extends (chain: ChainName, ...args: infer A) => infer R
  ? (...args: A) => R
  : Fn;

type OmitRpc<P extends PlatformName, Fn> = Fn extends (
  rpc: RpcConnection<P>,
  ...args: infer A
) => infer R
  ? (...args: A) => R
  : Fn;

type OmitChainRpc<
  P extends PlatformName,
  F extends keyof Platform<P>
> = OmitRpc<P, OmitChain<Platform<P>[F]>>;

export abstract class ChainContext<P extends PlatformName> {
  // Cached objects
  protected tokenBridge?: TokenBridge<P>;
  protected autoTokenBridge?: AutomaticTokenBridge<P>;
  protected circleBridge?: CircleBridge<P>;
  protected autoCircleBridge?: AutomaticCircleBridge<P>;

  constructor(readonly platform: Platform<P>, readonly chain: ChainName) {}

  abstract getRpc(): RpcConnection<P>;

  getWrappedAsset: OmitChainRpc<P, "getWrappedAsset"> = (token) => {
    return this.platform.getWrappedAsset(this.chain, this.getRpc(), token);
  };

  getTokenDecimals: OmitRpc<P, Platform<P>["getTokenDecimals"]> = (
    tokenAddr
  ) => {
    return this.platform.getTokenDecimals(this.getRpc(), tokenAddr);
  };

  getNativeBalance: OmitRpc<P, Platform<P>["getNativeBalance"]> = (
    walletAddress
  ) => {
    return this.platform.getNativeBalance(this.getRpc(), walletAddress);
  };

  getTokenBalance: OmitChainRpc<P, "getTokenBalance"> = (
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

  parseTransaction: OmitChainRpc<P, "parseTransaction"> = (txid) => {
    return this.platform.parseTransaction(this.chain, this.getRpc(), txid);
  };

  sendWait: OmitRpc<P, Platform<P>["sendWait"]> = (stxns) => {
    return this.platform.sendWait(this.getRpc(), stxns);
  };

  // protocols
  getTokenBridge: OmitRpc<P, Platform<P>["getTokenBridge"]> = async () => {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRpc());
    return this.tokenBridge;
  };

  getAutomaticTokenBridge: OmitRpc<P, Platform<P>["getAutomaticTokenBridge"]> =
    async () => {
      this.autoTokenBridge = this.autoTokenBridge
        ? this.autoTokenBridge
        : await this.platform.getAutomaticTokenBridge(this.getRpc());
      return this.autoTokenBridge;
    };

  getCircleBridge: OmitRpc<P, Platform<P>["getCircleBridge"]> = async () => {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getCircleBridge(this.getRpc());
    return this.circleBridge;
  };

  getAutomaticCircleBridge: OmitRpc<
    P,
    Platform<P>["getAutomaticCircleBridge"]
  > = async () => {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getAutomaticCircleBridge(this.getRpc());
    return this.autoCircleBridge;
  };
}
