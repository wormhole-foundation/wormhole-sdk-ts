import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";

import { Platform } from "./platform";
import {
  AutomaticTokenBridge,
  TokenBridge,
  supportsAutomaticTokenBridge,
  supportsTokenBridge,
} from "./protocols/tokenBridge";
import {
  supportsAutomaticCircleBridge,
  supportsCircleBridge,
  AutomaticCircleBridge,
  CircleBridge,
} from "./protocols/cctp";
import { supportsIbcBridge, IbcBridge } from "./protocols/ibc";
import { RpcConnection } from "./rpc";
import { SignedTx, TokenId } from "./types";
import { WormholeMessageId } from "./attestation";

export abstract class ChainContext<P extends PlatformName> {
  // Cached Protocol clients
  protected rpc?: RpcConnection<P>;
  protected tokenBridge?: TokenBridge<P>;
  protected autoTokenBridge?: AutomaticTokenBridge<P>;
  protected circleBridge?: CircleBridge<P>;
  protected autoCircleBridge?: AutomaticCircleBridge<P>;
  protected ibcBridge?: IbcBridge<P>;

  abstract platform: Platform<P>;

  constructor(readonly chain: ChainName) {}

  getRpc(): Promise<RpcConnection<P>> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc;
  }

  // Get the number of decimals for a token
  async getDecimals(token: TokenId | "native"): Promise<bigint> {
    return this.platform.getDecimals(this.chain, this.getRpc(), token);
  }

  // Get the balance of a token for a given address
  async getBalance(
    walletAddr: string,
    token: TokenId | "native",
  ): Promise<bigint | null> {
    return this.platform.getBalance(
      this.chain,
      await this.getRpc(),
      walletAddr,
      token,
    );
  }

  async getCurrentBlock(): Promise<number> {
    return this.platform.getCurrentBlock(this.getRpc());
  }

  // Get details about the transaction
  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    return this.platform.parseTransaction(
      this.chain,
      await this.getRpc(),
      txid,
    );
  }

  // Send a transaction and wait for it to be confirmed
  async sendWait(stxns: SignedTx): Promise<string[]> {
    return this.platform.sendWait(this.chain, await this.getRpc(), stxns);
  }

  //
  // protocols
  //

  //
  supportsTokenBridge = () => supportsTokenBridge<P>(this.platform);
  async getTokenBridge(): Promise<TokenBridge<P>> {
    if (!supportsTokenBridge<P>(this.platform))
      throw new Error("Platform does not support TokenBridge");

    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(await this.getRpc());

    return this.tokenBridge;
  }

  //
  supportsAutomaticTokenBridge = () =>
    supportsAutomaticTokenBridge<P>(this.platform);
  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<P>> {
    if (!supportsAutomaticTokenBridge<P>(this.platform))
      throw new Error("Platform does not support AutomaticTokenBridge");

    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getAutomaticTokenBridge(await this.getRpc());
    return this.autoTokenBridge;
  }

  //
  supportsCircleBridge = () => supportsCircleBridge<P>(this.platform);
  async getCircleBridge(): Promise<CircleBridge<P>> {
    if (!supportsCircleBridge<P>(this.platform))
      throw new Error("Platform does not support CircleBridge");

    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getCircleBridge(await this.getRpc());
    return this.circleBridge;
  }

  //
  supportsAutomaticCircleBridge = () =>
    supportsAutomaticCircleBridge<P>(this.platform);
  async getAutomaticCircleBridge(): Promise<AutomaticCircleBridge<P>> {
    if (!supportsAutomaticCircleBridge<P>(this.platform))
      throw new Error("Platform does not support AutomaticCircleBridge");

    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getAutomaticCircleBridge(await this.getRpc());
    return this.autoCircleBridge;
  }

  //
  supportsIbcBridge = () => supportsIbcBridge<P>(this.platform);
  async getIbcBridge(): Promise<IbcBridge<P>> {
    if (!supportsIbcBridge<P>(this.platform))
      throw new Error("Platform does not support AutomaticCircleBridge");

    this.ibcBridge = this.ibcBridge
      ? this.ibcBridge
      : await this.platform.getIbcBridge(await this.getRpc());
    return this.ibcBridge;
  }
}
