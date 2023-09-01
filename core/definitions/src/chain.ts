import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { Platform } from "./platform";
import { RpcConnection } from "./rpc";
import { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge";
import { AutomaticCircleBridge, CircleBridge } from "./protocols/cctp";

// TODO: there has to be a nicer way to do this
// This requires the arguments in the function definition come in the same order
// [chain], [rpc], ...

type _omitChain<Fn> = Fn extends (chain: ChainName, ...args: infer A) => infer R
  ? (...args: A) => R
  : Fn;
type _omitRpc<P extends PlatformName, Fn> = Fn extends (
  rpc: RpcConnection<P>,
  ...args: infer A
) => infer R
  ? (...args: A) => R
  : Fn;

type OmitChainRpc<
  P extends PlatformName,
  F extends keyof Platform<P>
> = _omitRpc<P, _omitChain<Platform<P>[F]>>;

type OmitRpc<P extends PlatformName, F extends keyof Platform<P>> = _omitRpc<
  P,
  Platform<P>[F]
>;

type OmitChain<
  P extends PlatformName,
  F extends keyof Platform<P>
> = _omitChain<Platform<P>[F]>;

export abstract class ChainContext<P extends PlatformName> {
  // Cached Protocol clients
  protected tokenBridge?: TokenBridge<P>;
  protected autoTokenBridge?: AutomaticTokenBridge<P>;
  protected circleBridge?: CircleBridge<P>;
  protected autoCircleBridge?: AutomaticCircleBridge<P>;

  constructor(readonly platform: Platform<P>, readonly chain: ChainName) {}

  abstract getRpc(): RpcConnection<P>;

  getWrappedAsset: OmitChainRpc<P, "getWrappedAsset"> = (token) => {
    return this.platform.getWrappedAsset(this.chain, this.getRpc(), token);
  };

  getTokenDecimals: OmitRpc<P, "getTokenDecimals"> = (token) => {
    return this.platform.getTokenDecimals(this.getRpc(), token);
  };

  getNativeBalance: OmitRpc<P, "getNativeBalance"> = (walletAddress) => {
    return this.platform.getNativeBalance(this.getRpc(), walletAddress);
  };

  getTokenBalance: OmitChainRpc<P, "getTokenBalance"> = (walletAddr, token) => {
    return this.platform.getTokenBalance(
      this.chain,
      this.getRpc(),
      walletAddr,
      token
    );
  };

  parseTransaction: OmitChainRpc<P, "parseTransaction"> = (txid) => {
    return this.platform.parseTransaction(this.chain, this.getRpc(), txid);
  };

  parseAddress: OmitChain<P, "parseAddress"> = (address) => {
    return this.platform.parseAddress(this.chain, address);
  };

  sendWait: OmitRpc<P, "sendWait"> = (stxns) => {
    return this.platform.sendWait(this.getRpc(), stxns);
  };

  // protocols
  getTokenBridge: OmitRpc<P, "getTokenBridge"> = async () => {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRpc());
    return this.tokenBridge;
  };

  getAutomaticTokenBridge: OmitRpc<P, "getAutomaticTokenBridge"> = async () => {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getAutomaticTokenBridge(this.getRpc());
    return this.autoTokenBridge;
  };

  getCircleBridge: OmitRpc<P, "getCircleBridge"> = async () => {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getCircleBridge(this.getRpc());
    return this.circleBridge;
  };

  getAutomaticCircleBridge: OmitRpc<P, "getAutomaticCircleBridge"> =
    async () => {
      this.autoCircleBridge = this.autoCircleBridge
        ? this.autoCircleBridge
        : await this.platform.getAutomaticCircleBridge(this.getRpc());
      return this.autoCircleBridge;
    };
}
