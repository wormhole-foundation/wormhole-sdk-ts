import type { Chain, ChainToPlatform, Network, Platform } from "@wormhole-foundation/sdk-base";
import { tokens } from "@wormhole-foundation/sdk-base";
import type { ChainAddress, UniversalOrNative } from "./address.js";
import { toNative } from "./address.js";
import type { WormholeMessageId } from "./attestation.js";
import type { PlatformContext } from "./platform.js";
import type { ProtocolName } from "./protocol.js";
import { protocolIsRegistered } from "./protocol.js";
import type { AutomaticCircleBridge, CircleBridge } from "./protocols/circleBridge/circleBridge.js";
import type { WormholeCore } from "./protocols/core/core.js";
import type { IbcBridge } from "./protocols/ibc/ibc.js";
import type { PorticoBridge } from "./protocols/portico/portico.js";
import type { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge/tokenBridge.js";
import type { RpcConnection } from "./rpc.js";
import type { ChainConfig, SignedTx, TokenAddress, TokenId } from "./types.js";
import { canonicalAddress, isNative } from "./types.js";
import { Ntt } from "./index.js";

/**
 * A ChainContext provides a consistent interface for interacting with a chain.
 * It holds the configuration for the chain and cached RPC and protocol clients.
 *
 */
export abstract class ChainContext<
  N extends Network,
  C extends Chain = Chain,
  P extends Platform = ChainToPlatform<C>,
> {
  readonly network: N;
  readonly chain: C;
  readonly config: ChainConfig<N, C>;
  readonly platform: PlatformContext<N, P>;

  // Cached Protocol clients
  protected rpc?: RpcConnection<P>;
  protected coreBridge?: WormholeCore<N, C>;
  protected tokenBridge?: TokenBridge<N, C>;
  protected autoTokenBridge?: AutomaticTokenBridge<N, C>;
  protected circleBridge?: CircleBridge<N, C>;
  protected autoCircleBridge?: AutomaticCircleBridge<N, C>;
  protected ibcBridge?: IbcBridge<N, C>;
  protected porticoBridge?: PorticoBridge<N, C>;

  constructor(chain: C, platform: PlatformContext<N, P>, rpc?: RpcConnection<P>) {
    this.config = platform.config[chain]!;
    this.platform = platform;
    this.chain = this.config.key;
    this.network = this.config.network;
    this.rpc = rpc;
  }

  /**
   * Get an RPC connection for this chain, uses the configuration passed in
   * the initial constructor
   *
   * @returns the RPC connection for this chain
   */
  getRpc(): Promise<RpcConnection<P>> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc;
  }

  /**
   *  Get the number of decimals for a token
   *
   *  @param token the token to get the decimals for
   *  @returns the number of decimals for the token
   */
  async getDecimals(token: TokenAddress<C>): Promise<number> {
    if (isNative(token)) return this.config.nativeTokenDecimals;

    // try to find it in the token cache first
    if (this.config.tokenMap) {
      const tokenAddress = canonicalAddress({ chain: this.chain, address: token });
      const found = tokens.getTokenByAddress(this.network, this.chain, tokenAddress);
      if (found) return found.decimals;
    }

    return this.platform.utils().getDecimals(this.chain, await this.getRpc(), token);
  }

  /**
   * Get the balance of a token for a given address
   *
   * @param walletAddr the address to get the balance for
   * @param token the token to get the balance for
   * @returns the balance of the token for the address
   *
   */
  async getBalance(walletAddr: string, token: TokenAddress<C>): Promise<bigint | null> {
    return this.platform.utils().getBalance(this.chain, await this.getRpc(), walletAddr, token);
  }

  /**
   * Get the latest block number seen by the chain according to the RPC
   *
   * @returns the latest block number
   */
  async getLatestBlock(): Promise<number> {
    return this.platform.utils().getLatestBlock(await this.getRpc());
  }

  /**
   * Get the latest _finalized_ block number seen by the chain according to the RPC
   *
   * @returns the latest finalized block number
   */
  async getLatestFinalizedBlock(): Promise<number> {
    return this.platform.utils().getLatestFinalizedBlock(await this.getRpc());
  }

  /**
   * Parse the Wormhole Core messages from a transaction
   *
   * @param txid the transaction to parse
   * @returns the Wormhole Core messages emitted by the transaction
   */
  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    return this.platform.parseWormholeMessages(this.chain, await this.getRpc(), txid);
  }

  /**
   *  Send a transaction and wait for it to be confirmed
   *
   * @param stxns the signed transaction to send
   * @returns the transaction hashes of the sent transactions
   */
  async sendWait(stxns: SignedTx[]): Promise<string[]> {
    return this.platform.utils().sendWait(this.chain, await this.getRpc(), stxns);
  }

  /**
   * Get the token data from the local cache if available
   * @param symbol the symbol of the token to get
   * @returns the token data if available
   */
  getToken(symbol: tokens.TokenSymbol): tokens.Token | undefined {
    if (!this.config.tokenMap) return;
    if (!(symbol in this.config.tokenMap)) return;
    return this.config.tokenMap[symbol];
  }

  /**
   * Get the token id of the wrapped token for the native gas token
   *
   * @returns the wrapped token for the native gas token
   */

  async getNativeWrappedTokenId(): Promise<TokenId<C>> {
    // see if we have it configured
    if (this.config.wrappedNative) {
      const { address } = this.config.wrappedNative;
      return { chain: this.chain, address: toNative(this.chain, address) };
    }

    // otherwise grab it from the token bridge fn
    const tb = await this.getTokenBridge();
    return { chain: this.chain, address: await tb.getWrappedNative() };
  }

  /**
   * Get the token account for a given address and token
   *
   * @remarks
   * This is really only useful in the context of Solana but in order
   * to provide a consistent interface, we provide it here.
   *
   * @param address the address to get the token account for
   * @param token the token to get the token account for
   * @returns the token account for the address and token
   */
  async getTokenAccount(
    address: UniversalOrNative<C>,
    token: TokenAddress<C>,
  ): Promise<ChainAddress<C>> {
    // Noop by default, override in implementation if necessary
    return { chain: this.chain, address };
  }

  /**
   * Check to see if a given protocol is supported by this chain
   * by checking if it is registered in the platform and the configuration
   * is available and correct
   *
   * @param protocolName the name of the Protocol to check for support
   * @returns a boolean indicating if this protocol is supported
   */
  supportsProtocol(protocolName: ProtocolName): boolean {
    return protocolIsRegistered(this.chain, protocolName);
  }

  /**
   * Check to see if the Wormhole Core protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Wormhole Core protocol
   */
  supportsWormholeCore = () => this.supportsProtocol("WormholeCore");
  /**
   * Get the Wormhole Core protocol client for this chain
   * @returns the Wormhole Core protocol client for this chain
   */
  async getWormholeCore(): Promise<WormholeCore<N, C>> {
    this.coreBridge = this.coreBridge
      ? this.coreBridge
      : await this.platform.getProtocol("WormholeCore", await this.getRpc());
    return this.coreBridge;
  }

  /**
   * Check to see if the Token Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Token Bridge protocol
   */
  supportsTokenBridge = () => this.supportsProtocol("TokenBridge");
  /**
   * Get the Token Bridge protocol client for this chain
   * @returns the Token Bridge protocol client for this chain
   */
  async getTokenBridge(): Promise<TokenBridge<N, C>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getProtocol("TokenBridge", await this.getRpc());
    return this.tokenBridge;
  }

  /**
   * Check to see if the Automatic Token Bridge protocol is supported by this chain
   * @returns  a boolean indicating if this chain supports the Automatic Token Bridge protocol
   */
  supportsAutomaticTokenBridge = () => this.supportsProtocol("AutomaticTokenBridge");
  /**
   * Get the Automatic Token Bridge protocol client for this chain
   * @returns the Automatic Token Bridge protocol client for this chain
   */
  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<N, C>> {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getProtocol("AutomaticTokenBridge", await this.getRpc());
    return this.autoTokenBridge;
  }

  /**
   * Check to see if the Circle Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Circle Bridge protocol
   */
  supportsCircleBridge = () => this.supportsProtocol("CircleBridge");
  /**
   * Get the Circle Bridge protocol client for this chain
   * @returns the Circle Bridge protocol client for this chain
   */
  async getCircleBridge(): Promise<CircleBridge<N, C>> {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getProtocol("CircleBridge", await this.getRpc());
    return this.circleBridge;
  }

  /**
   * Check to see if the Automatic Circle Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Automatic Circle Bridge protocol
   */
  supportsAutomaticCircleBridge = () => this.supportsProtocol("AutomaticCircleBridge");
  /**
   * Get the Automatic Circle Bridge protocol client for this chain
   * @returns the Automatic Circle Bridge protocol client for this chain
   */
  async getAutomaticCircleBridge(): Promise<AutomaticCircleBridge<N, C>> {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getProtocol("AutomaticCircleBridge", await this.getRpc());
    return this.autoCircleBridge;
  }

  /**
   * Check to see if the IBC Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the IBC Bridge protocol
   */
  supportsIbcBridge = () => this.supportsProtocol("IbcBridge");
  /**
   * Get the IBC Bridge protocol client for this chain
   * @returns the IBC Bridge protocol client for this chain
   */
  async getIbcBridge(): Promise<IbcBridge<N, C>> {
    this.ibcBridge = this.ibcBridge
      ? this.ibcBridge
      : await this.platform.getProtocol("IbcBridge", await this.getRpc());
    return this.ibcBridge;
  }

  /**
   * Check to see if the Portico Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Portico Bridge protocol
   */
  supportsPorticoBridge = () => this.supportsProtocol("PorticoBridge");
  /**
   * Get the Portico Bridge protocol client for this chain
   * @returns the Portico Bridge protocol client for this chain
   */
  async getPorticoBridge(): Promise<PorticoBridge<N, C>> {
    this.porticoBridge = this.porticoBridge
      ? this.porticoBridge
      : await this.platform.getProtocol("PorticoBridge", await this.getRpc());
    return this.porticoBridge;
  }

  /**
   * Check to see if the Ntt protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Ntt protocol
   */
  supportsNtt = () => this.supportsProtocol("Ntt");
  /**
   * Get the Ntt protocol client for this chain
   * @returns the Ntt protocol client for this chain
   */
  async getNtt(tokenAddress: string): Promise<Ntt<N, C>> {
    return this.platform.getProtocol("Ntt", await this.getRpc(), tokenAddress);
  }
}
