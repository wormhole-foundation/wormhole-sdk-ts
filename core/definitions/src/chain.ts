import { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";

import { WormholeMessageId } from "./attestation";
import { PlatformContext, PlatformUtils } from "./platform";
import {
  AutomaticCircleBridge,
  CircleBridge,
  supportsAutomaticCircleBridge,
  supportsCircleBridge,
} from "./protocols/cctp";
import { IbcBridge, supportsIbcBridge } from "./protocols/ibc";
import {
  AutomaticTokenBridge,
  TokenBridge,
  supportsAutomaticTokenBridge,
  supportsTokenBridge,
} from "./protocols/tokenBridge";
import { RpcConnection } from "./rpc";
import { ChainConfig, SignedTx } from "./types";
import { TokenAddress } from "./address";

export abstract class ChainContext<
  N extends Network,
  P extends Platform,
  C extends Chain = PlatformToChains<P>,
> {
  readonly network: N;

  readonly platform: PlatformContext<N, P>;
  readonly platformUtils: PlatformUtils<N, P>;

  readonly chain: C;
  readonly config: ChainConfig<N, C>;

  // Cached Protocol clients
  protected rpc?: RpcConnection<P>;
  protected tokenBridge?: TokenBridge<P, C>;
  protected autoTokenBridge?: AutomaticTokenBridge<P, C>;
  protected circleBridge?: CircleBridge<P, C>;
  protected autoCircleBridge?: AutomaticCircleBridge<P, C>;
  protected ibcBridge?: IbcBridge<P, C>;

  constructor(chain: C, platform: PlatformContext<N, P>) {
    this.config = platform.config[chain];
    this.platform = platform;
    this.platformUtils = platform.constructor as any as PlatformUtils<N, P>;
    this.chain = this.config.key;
    this.network = this.config.network;
  }

  getRpc(): Promise<RpcConnection<P>> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc;
  }

  // Get the number of decimals for a token
  async getDecimals(token: TokenAddress<C>): Promise<bigint> {
    return this.platformUtils.getDecimals(this.chain, this.getRpc(), token);
  }

  // Get the balance of a token for a given address
  async getBalance(walletAddr: string, token: TokenAddress<C>): Promise<bigint | null> {
    return this.platformUtils.getBalance(this.chain, await this.getRpc(), walletAddr, token);
  }

  async getCurrentBlock(): Promise<number> {
    return this.platformUtils.getCurrentBlock(this.getRpc());
  }

  // Get details about the transaction
  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    return this.platform.parseTransaction(this.chain, await this.getRpc(), txid);
  }

  // Send a transaction and wait for it to be confirmed
  async sendWait(stxns: SignedTx): Promise<string[]> {
    return this.platformUtils.sendWait(this.chain, await this.getRpc(), stxns);
  }

  //
  // protocols
  //
  //

  supportsTokenBridge = () => supportsTokenBridge<P>(this.platform);
  async getTokenBridge(): Promise<TokenBridge<P, C>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getProtocol("TokenBridge", await this.getRpc());
    return this.tokenBridge;
  }

  //
  supportsAutomaticTokenBridge = () => supportsAutomaticTokenBridge<P>(this.platform);
  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<P, C>> {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getProtocol("AutomaticTokenBridge", await this.getRpc());
    return this.autoTokenBridge;
  }

  //
  supportsCircleBridge = () => supportsCircleBridge<P>(this.platform);
  async getCircleBridge(): Promise<CircleBridge<P, C>> {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getProtocol("CircleBridge", await this.getRpc());
    return this.circleBridge;
  }

  //
  supportsAutomaticCircleBridge = () => supportsAutomaticCircleBridge<P>(this.platform);
  async getAutomaticCircleBridge(): Promise<AutomaticCircleBridge<P, C>> {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getProtocol("AutomaticCircleBridge", await this.getRpc());
    return this.autoCircleBridge;
  }

  //
  supportsIbcBridge = () => supportsIbcBridge<P>(this.platform);
  async getIbcBridge(): Promise<IbcBridge<P, C>> {
    this.ibcBridge = this.ibcBridge
      ? this.ibcBridge
      : await this.platform.getProtocol("IbcBridge", await this.getRpc());
    return this.ibcBridge;
  }
}
