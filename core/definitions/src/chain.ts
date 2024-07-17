import type {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  Token,
  TokenSymbol,
} from "@wormhole-foundation/sdk-base";
import { getTokenByAddress } from "@wormhole-foundation/sdk-base/tokens";
import type { ChainAddress, UniversalOrNative } from "./address.js";
import { toNative } from "./address.js";
import type { WormholeMessageId } from "./attestation.js";
import type {
  AutomaticCircleBridge,
  CircleBridge,
  Contracts,
  IbcBridge,
  PorticoBridge,
  WormholeCore,
} from "./index.js";
import type { PlatformContext } from "./platform.js";
import type { ProtocolInstance, ProtocolInterface, ProtocolName } from "./protocol.js";
import { isVersionedProtocolInitializer, protocolIsRegistered } from "./protocol.js";
import type { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge/tokenBridge.js";
import type { RpcConnection } from "./rpc.js";
import type { ChainConfig, SignedTx, TokenAddress, TokenId } from "./types.js";
import { canonicalAddress, isNative } from "./types.js";

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

  protected rpc?: RpcConnection<P>;

  // Cached Protocol clients
  protected protocols: Map<ProtocolName, ProtocolInterface<ProtocolName, N, C>> = new Map();

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
      const found = getTokenByAddress(this.network, this.chain, tokenAddress);
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
  getToken(symbol: TokenSymbol): Token | undefined {
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
   * Construct a protocol client for the given protocol
   *
   * Note: If no contracts are passed, we assume the default contracts should be used
   * and that the protocol client is cacheable
   *
   * @param protocolName The name of the protocol to construct a client for
   * @returns An instance of the protocol client that implements the protocol interface for the chain
   */
  async getProtocol<PN extends ProtocolName>(
    protocolName: PN,
    contracts?: Contracts,
    rpc?: RpcConnection<P>,
  ): Promise<ProtocolInstance<P, PN, N, C>> {
    if (!contracts && this.protocols.has(protocolName)) return this.protocols.get(protocolName)!;

    const _contracts = contracts
      ? { ...this.config.contracts, ...contracts }
      : this.config.contracts;
    const _rpc = rpc ?? (await this.getRpc());
    const ctor = this.platform.getProtocolInitializer(protocolName);

    let protocol;
    if (rpc) {
      if (contracts)
        // TODO: the platforms `getProtocol` does not allow passing contracts
        //  it would need to be updated to allow this
        throw new Error(
          "Custom contracts are currently not supported with custom rpc connection. Add the contracts to the base config.",
        );
      // This ultimately calls fromRpc which _should_ handle version fetching
      protocol = await this.platform.getProtocol(protocolName, _rpc);
    } else {
      if (isVersionedProtocolInitializer(ctor)) {
        const version = await ctor.getVersion(_rpc, _contracts);
        protocol = new ctor(this.network, this.chain, _rpc, _contracts, version);
      } else {
        protocol = new ctor(this.network, this.chain, _rpc, _contracts);
      }
    }

    if (!contracts) this.protocols.set(protocolName, protocol);

    return protocol;
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
  getWormholeCore = (): Promise<WormholeCore<N, C>> => this.getProtocol("WormholeCore");

  /**
   * Check to see if the Token Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Token Bridge protocol
   */
  supportsTokenBridge = () => this.supportsProtocol("TokenBridge");
  /**
   * Get the Token Bridge protocol client for this chain
   * @returns the Token Bridge protocol client for this chain
   */
  getTokenBridge = (): Promise<TokenBridge<N, C>> => this.getProtocol("TokenBridge");

  /**
   * Check to see if the Automatic Token Bridge protocol is supported by this chain
   * @returns  a boolean indicating if this chain supports the Automatic Token Bridge protocol
   */
  supportsAutomaticTokenBridge = () => this.supportsProtocol("AutomaticTokenBridge");
  /**
   * Get the Automatic Token Bridge protocol client for this chain
   * @returns the Automatic Token Bridge protocol client for this chain
   */
  getAutomaticTokenBridge = (): Promise<AutomaticTokenBridge<N, C>> =>
    this.getProtocol("AutomaticTokenBridge");

  /**
   * Check to see if the Circle Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Circle Bridge protocol
   */
  supportsCircleBridge = () => this.supportsProtocol("CircleBridge");
  /**
   * Get the Circle Bridge protocol client for this chain
   * @returns the Circle Bridge protocol client for this chain
   */
  getCircleBridge = (): Promise<CircleBridge<N, C>> => this.getProtocol("CircleBridge");

  /**
   * Check to see if the Automatic Circle Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Automatic Circle Bridge protocol
   */
  supportsAutomaticCircleBridge = () => this.supportsProtocol("AutomaticCircleBridge");
  /**
   * Get the Automatic Circle Bridge protocol client for this chain
   * @returns the Automatic Circle Bridge protocol client for this chain
   */
  getAutomaticCircleBridge = (): Promise<AutomaticCircleBridge<N, C>> =>
    this.getProtocol("AutomaticCircleBridge");

  /**
   * Check to see if the IBC Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the IBC Bridge protocol
   */
  supportsIbcBridge = () => this.supportsProtocol("IbcBridge");
  /**
   * Get the IBC Bridge protocol client for this chain
   * @returns the IBC Bridge protocol client for this chain
   */
  getIbcBridge = (): Promise<IbcBridge<N, C>> => this.getProtocol("IbcBridge");

  /**
   * Check to see if the Portico Bridge protocol is supported by this chain
   * @returns a boolean indicating if this chain supports the Portico Bridge protocol
   */
  supportsPorticoBridge = () => this.supportsProtocol("PorticoBridge");
  /**
   * Get the Portico Bridge protocol client for this chain
   * @returns the Portico Bridge protocol client for this chain
   */
  getPorticoBridge = (): Promise<PorticoBridge<N, C>> => this.getProtocol("PorticoBridge");
}
