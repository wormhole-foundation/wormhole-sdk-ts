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

  // Utils for platform specific queries
  getDecimals: OmitChainRpc<P, "getDecimals"> = (token) => {
    return this.platform.getDecimals(this.chain, this.getRpc(), token);
  };

  getBalance: OmitChainRpc<P, "getBalance"> = (walletAddr, token) => {
    return this.platform.getBalance(
      this.chain,
      this.getRpc(),
      walletAddr,
      token
    );
  };

  // Get details about the transaction
  parseTransaction: OmitChainRpc<P, "parseTransaction"> = (txid) => {
    return this.platform.parseTransaction(this.chain, this.getRpc(), txid);
  };

  // Send a transaction and wait for it to be confirmed
  sendWait: OmitChainRpc<P, "sendWait"> = (stxns) => {
    return this.platform.sendWait(this.chain, this.getRpc(), stxns);
  };

  // Take a native address and convert it to a UniversalAddress
  parseAddress: OmitChain<P, "parseAddress"> = (address) => {
    return this.platform.parseAddress(this.chain, address);
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
