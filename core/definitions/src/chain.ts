import {
  Chain,
  Network,
  Platform,
  PlatformToChains,
  ProtocolName,
} from "@wormhole-foundation/sdk-base";

import { ChainAddress, TokenAddress, UniversalOrNative } from "./address";
import { WormholeMessageId } from "./attestation";
import { PlatformContext } from "./platform";
import { protocolIsRegistered } from "./protocol";
import { AutomaticCircleBridge, CircleBridge } from "./protocols/circleBridge";
import { IbcBridge } from "./protocols/ibc";
import { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge";
import { RpcConnection } from "./rpc";
import { ChainConfig, SignedTx, TokenId } from "./types";
import { WormholeCore } from "./protocols/core";

export abstract class ChainContext<
  N extends Network,
  P extends Platform,
  C extends Chain = PlatformToChains<P>,
> {
  readonly network: N;

  readonly platform: PlatformContext<N, P>;

  readonly chain: C;
  readonly config: ChainConfig<N, C>;

  // Cached Protocol clients
  protected rpc?: RpcConnection<P>;
  protected coreBridge?: WormholeCore<N, P, C>;
  protected tokenBridge?: TokenBridge<N, P, C>;
  protected autoTokenBridge?: AutomaticTokenBridge<N, P, C>;
  protected circleBridge?: CircleBridge<N, P, C>;
  protected autoCircleBridge?: AutomaticCircleBridge<N, P, C>;
  protected ibcBridge?: IbcBridge<N, P, C>;

  constructor(chain: C, platform: PlatformContext<N, P>, rpc?: RpcConnection<P>) {
    this.config = platform.config[chain]!;
    this.platform = platform;
    this.chain = this.config.key;
    this.network = this.config.network;
    this.rpc = rpc;
  }

  getRpc(): Promise<RpcConnection<P>> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc;
  }

  // Get the number of decimals for a token
  async getDecimals(token: TokenAddress<C>): Promise<bigint> {
    return this.platform.utils().getDecimals(this.chain, this.getRpc(), token);
  }

  // Get the balance of a token for a given address
  async getBalance(walletAddr: string, token: TokenAddress<C>): Promise<bigint | null> {
    return this.platform.utils().getBalance(this.chain, await this.getRpc(), walletAddr, token);
  }

  async getLatestBlock(): Promise<number> {
    return this.platform.utils().getLatestBlock(this.getRpc());
  }

  async getLatestFinalizedBlock(): Promise<number> {
    return this.platform.utils().getLatestFinalizedBlock(this.getRpc());
  }

  // Get details about the transaction
  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    return this.platform.parseWormholeMessages(this.chain, await this.getRpc(), txid);
  }

  // Send a transaction and wait for it to be confirmed
  async sendWait(stxns: SignedTx): Promise<string[]> {
    return this.platform.utils().sendWait(this.chain, await this.getRpc(), stxns);
  }

  async getNativeWrappedTokenId(): Promise<TokenId<C>> {
    const tb = await this.getTokenBridge();
    return { chain: this.chain, address: await tb.getWrappedNative() };
  }

  // Get the token account for a given address
  async getTokenAccount(
    address: UniversalOrNative<C>,
    token: UniversalOrNative<C>,
  ): Promise<ChainAddress<C>> {
    // Noop by default, override in implementation if necessary
    return { chain: this.chain, address };
  }

  //
  // protocols
  //
  //
  supportsProtocol(protocolName: ProtocolName): boolean {
    return protocolIsRegistered(this.chain, protocolName);
  }

  supportsWormholeCore = () => this.supportsProtocol("WormholeCore");
  async getWormholeCore(): Promise<WormholeCore<N, P, C>> {
    this.coreBridge = this.coreBridge
      ? this.coreBridge
      : await this.platform.getProtocol("WormholeCore", await this.getRpc());
    return this.coreBridge;
  }

  supportsTokenBridge = () => this.supportsProtocol("TokenBridge");
  async getTokenBridge(): Promise<TokenBridge<N, P, C>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getProtocol("TokenBridge", await this.getRpc());
    return this.tokenBridge;
  }

  //
  supportsAutomaticTokenBridge = () => this.supportsProtocol("AutomaticTokenBridge");
  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<N, P, C>> {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getProtocol("AutomaticTokenBridge", await this.getRpc());
    return this.autoTokenBridge;
  }

  //
  supportsCircleBridge = () => this.supportsProtocol("CircleBridge");
  async getCircleBridge(): Promise<CircleBridge<N, P, C>> {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getProtocol("CircleBridge", await this.getRpc());
    return this.circleBridge;
  }

  //
  supportsAutomaticCircleBridge = () => this.supportsProtocol("AutomaticCircleBridge");
  async getAutomaticCircleBridge(): Promise<AutomaticCircleBridge<N, P, C>> {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getProtocol("AutomaticCircleBridge", await this.getRpc());
    return this.autoCircleBridge;
  }

  //
  supportsIbcBridge = () => this.supportsProtocol("IbcBridge");
  async getIbcBridge(): Promise<IbcBridge<N, P, C>> {
    this.ibcBridge = this.ibcBridge
      ? this.ibcBridge
      : await this.platform.getProtocol("IbcBridge", await this.getRpc());
    return this.ibcBridge;
  }
}
