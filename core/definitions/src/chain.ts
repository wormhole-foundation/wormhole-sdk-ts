import { Chain, ChainToPlatform, Network, Platform } from "@wormhole-foundation/sdk-base";

import { NativeAddress } from "./address";
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
import { UniversalAddress } from "./universalAddress";

export abstract class ChainContext<
  N extends Network,
  C extends Chain,
  P extends Platform = ChainToPlatform<C>,
> {
  abstract platform: PlatformContext<N, P>;
  readonly platformUtils: PlatformUtils<N, P>;

  readonly chain: C;

  // Cached Protocol clients
  protected rpc?: RpcConnection<P>;
  protected tokenBridge?: TokenBridge<P>;
  protected autoTokenBridge?: AutomaticTokenBridge<P>;
  protected circleBridge?: CircleBridge<P>;
  protected autoCircleBridge?: AutomaticCircleBridge<P>;
  protected ibcBridge?: IbcBridge<P>;

  constructor(readonly config: ChainConfig<N, C>) {
    this.chain = config.key;
  }

  getRpc(): Promise<RpcConnection<P>> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc;
  }

  // Get the number of decimals for a token
  async getDecimals(token: NativeAddress<P> | UniversalAddress | "native"): Promise<bigint> {
    return this.platformUtils.getDecimals(this.chain, this.getRpc(), token);
  }

  // Get the balance of a token for a given address
  async getBalance(
    walletAddr: string,
    token: NativeAddress<P> | UniversalAddress | "native",
  ): Promise<bigint | null> {
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
  async getTokenBridge(): Promise<TokenBridge<P>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getProtocol('TokenBridge', await this.getRpc());
    return this.tokenBridge;
  }

  //
  supportsAutomaticTokenBridge = () => supportsAutomaticTokenBridge<P>(this.platform);
  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<P>> {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getProtocol('AutomaticTokenBridge', await this.getRpc());
    return this.autoTokenBridge;
  }

  //
  supportsCircleBridge = () => supportsCircleBridge<P>(this.platform);
  async getCircleBridge(): Promise<CircleBridge<P>> {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getProtocol('CircleBridge', await this.getRpc());
    return this.circleBridge;
  }

  //
  supportsAutomaticCircleBridge = () => supportsAutomaticCircleBridge<P>(this.platform);
  async getAutomaticCircleBridge(): Promise<AutomaticCircleBridge<P>> {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getProtocol('AutomaticCircleBridge', await this.getRpc());
    return this.autoCircleBridge;
  }

  //
  supportsIbcBridge = () => supportsIbcBridge<P>(this.platform);
  async getIbcBridge(): Promise<IbcBridge<P>> {
    this.ibcBridge = this.ibcBridge
      ? this.ibcBridge
      : await this.platform.getProtocol('IbcBridge', await this.getRpc());
    return this.ibcBridge;
  }
}
