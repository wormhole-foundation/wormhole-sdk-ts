import type { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import { chainToPlatform, circle } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  Contracts,
  NativeAddress,
  PayloadDiscriminator,
  PayloadLiteral,
  PlatformContext,
  PlatformUtils,
  TokenAddress,
  TokenId,
  TxHash,
  UniversalAddress,
  WormholeMessageId,
  deserialize,
} from "@wormhole-foundation/sdk-definitions";
import {
  canonicalAddress,
  isNative,
  nativeTokenId,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { getCircleAttestationWithRetry } from "./circle-api.js";
import type { WormholeConfig, WormholeConfigOverrides } from "./config.js";
import { applyWormholeConfigOverrides } from "./config.js";
import { DEFAULT_TASK_TIMEOUT } from "./config.js";
import { CircleTransfer } from "./protocols/cctp/cctpTransfer.js";
import { TokenTransfer } from "./protocols/tokenBridge/tokenTransfer.js";
import type { RouteConstructor } from "./routes/index.js";
import { RouteResolver } from "./routes/resolver.js";
import { retry } from "./tasks.js";
import type { TransactionStatus } from "./whscan-api.js";
import {
  getIsVaaEnqueued,
  getTransactionStatusWithRetry,
  getTxsByAddress,
  getVaaByTxHashWithRetry,
  getVaaBytesWithRetry,
  getVaaWithRetry,
} from "./whscan-api.js";

type PlatformMap<N extends Network, P extends Platform = Platform> = Map<P, PlatformContext<N, P>>;
type ChainMap<N extends Network, C extends Chain = Chain> = Map<C, ChainContext<N, C>>;

export class Wormhole<N extends Network> {
  protected readonly _network: N;
  protected _platforms: PlatformMap<N>;
  protected _chains: ChainMap<N>;

  readonly config: WormholeConfig<N>;

  constructor(network: N, platforms: PlatformUtils<any>[], config?: WormholeConfigOverrides<N>) {
    this._network = network;
    this.config = applyWormholeConfigOverrides(network, config) as WormholeConfig<N>;

    this._chains = new Map();
    this._platforms = new Map();
    for (const p of platforms) {
      this._platforms.set(p._platform, new p(network, this.config.chains));
    }
  }

  get network(): N {
    return this._network;
  }

  /**
   * Creates a CircleTransfer object to move Native USDC from one chain to another
   * @param amount the amount to transfer
   * @param from the address to transfer from
   * @param to the address to transfer to
   * @param automatic whether to use automatic delivery
   * @param payload the payload to send with the transfer
   * @param nativeGas the amount of native gas to send with the transfer
   * @returns the CircleTransfer object
   * @throws Errors if the chain or protocol is not supported
   */
  async circleTransfer(
    amount: bigint,
    from: ChainAddress,
    to: ChainAddress,
    automatic: boolean,
    payload?: Uint8Array,
    nativeGas?: bigint,
  ): Promise<CircleTransfer<N>> {
    if (automatic && payload) throw new Error("Payload with automatic delivery is not supported");

    if (
      !circle.isCircleChain(this.network, from.chain) ||
      !circle.isCircleChain(this.network, to.chain) ||
      !circle.isCircleSupported(this.network, from.chain) ||
      !circle.isCircleSupported(this.network, to.chain)
    )
      throw new Error(`Network and chain not supported: ${this.network} ${from.chain} `);

    // ensure the amount is > fee + native gas
    if (automatic) {
      const acb = await this.getChain(from.chain).getAutomaticCircleBridge();
      const relayerFee = await acb.getRelayerFee(to.chain);
      const minAmount = relayerFee + (nativeGas ? nativeGas : 0n);
      if (amount < minAmount)
        throw new Error(`Amount must be > ${minAmount} (relayerFee + nativeGas)`);
    }

    return await CircleTransfer.from(this, {
      amount,
      from,
      to,
      automatic,
      payload,
      nativeGas,
    });
  }

  /**
   * Creates a TokenTransfer object to move a token from one chain to another
   * @param token the token to transfer
   * @param amount the amount to transfer
   * @param from the address to transfer from
   * @param to the address to transfer to
   * @param automatic whether to use automatic delivery
   * @param payload the payload to send with the transfer
   * @param nativeGas the amount of native gas to send with the transfer
   * @returns the TokenTransfer object
   * @throws Errors if the chain or protocol is not supported
   */
  async tokenTransfer(
    token: TokenId,
    amount: bigint,
    from: ChainAddress,
    to: ChainAddress,
    automatic: boolean,
    payload?: Uint8Array,
    nativeGas?: bigint,
  ): Promise<TokenTransfer<N>> {
    return await TokenTransfer.from(this, {
      token,
      amount,
      from,
      to,
      automatic,
      payload,
      nativeGas,
    });
  }

  /**
   * Gets a RouteResolver configured with the routes passed
   * @param routes the list RouteConstructors to use
   * @returns the RouteResolver
   */
  resolver(routes: RouteConstructor[]) {
    return new RouteResolver(this, routes);
  }

  /**
   * Gets the contract addresses for a given chain
   * @param chain the chain name
   * @returns the contract addresses
   */
  getContracts(chain: Chain): Contracts | undefined {
    return this.config.chains[chain]?.contracts;
  }

  /**
   * Returns the platform object, i.e. the class with platform-specific logic and methods
   * @param chain the platform name
   * @returns the platform context class
   * @throws Errors if platform is not found
   */
  getPlatform<P extends Platform>(platformName: P): PlatformContext<N, P> {
    const platform = this._platforms.get(platformName);
    if (!platform)
      throw new Error(
        `Not able to retrieve platform ${platformName}. Did it get registered in the constructor?`,
      );
    return platform as PlatformContext<N, P>;
  }

  /**
   * Returns the chain "context", i.e. the class with chain-specific logic and methods
   * @param chain the chain name
   * @returns the chain context class
   * @throws Errors if context is not found
   */
  getChain<C extends Chain>(chain: C): ChainContext<N, C> {
    const platform = chainToPlatform(chain);
    if (!this._chains.has(chain))
      this._chains.set(chain, this.getPlatform(platform).getChain(chain));
    return this._chains.get(chain)! as ChainContext<N, C>;
  }

  /**
   * Gets the TokenId for a token representation on any chain
   *  These are the Wormhole wrapped token addresses, not necessarily
   *  the canonical version of that token
   *
   * @param chain The chain name to get the wrapped token address
   * @param tokenId The Token ID (chain/address) of the original token
   * @returns The TokenId on the given chain, null if it does not exist
   * @throws Errors if the chain is not supported or the token does not exist
   */
  async getWrappedAsset<C extends Chain>(chain: C, token: TokenId<Chain>): Promise<TokenId<C>> {
    const ctx = this.getChain(chain);
    const tb = await ctx.getTokenBridge();
    return { chain, address: await tb.getWrappedAsset(token) };
  }

  /**
   *  Taking the original TokenId for some wrapped token chain
   *  These are the Wormhole wrapped token addresses, not necessarily
   *  the canonical version of that token
   *
   * @param tokenId The Token ID of the token we're looking up the original asset for
   * @returns The Original TokenId corresponding to the token id passed,
   * @throws Errors if the chain is not supported or the token does not exist
   */
  async getOriginalAsset<C extends Chain>(token: TokenId<C>): Promise<TokenId<Chain>> {
    const ctx = this.getChain(token.chain);
    const tb = await ctx.getTokenBridge();
    return await tb.getOriginalAsset(token.address);
  }

  /**
   * Returns the UniversalAddress of the token. This may require fetching on-chain data.
   * @param chain The chain to get the UniversalAddress for
   * @param token The address to get the UniversalAddress for
   * @returns The UniversalAddress of the token
   */
  async getTokenUniversalAddress<C extends Chain>(
    chain: C,
    token: NativeAddress<C>,
  ): Promise<UniversalAddress> {
    const ctx = this.getChain(chain);
    const tb = await ctx.getTokenBridge();
    return await tb.getTokenUniversalAddress(token);
  }

  /**
   * Returns the native address of the token. This may require fetching on-chain data.
   * @param chain The chain to get the native address for
   * @param originChain The chain the token is from / native to
   * @param token The address to get the native address for
   * @returns The native address of the token
   */
  async getTokenNativeAddress<C extends Chain>(
    chain: C,
    originChain: Chain,
    token: UniversalAddress,
  ): Promise<NativeAddress<C>> {
    const ctx = this.getChain(chain);
    const tb = await ctx.getTokenBridge();
    return await tb.getTokenNativeAddress(originChain, token);
  }

  /**
   * Gets the number of decimals for a token on a given chain
   *
   * @param chain The chain name or id of the token/representation
   * @param token The token address
   * @returns The number of decimals
   */
  async getDecimals<C extends Chain>(chain: C, token: TokenAddress<C>): Promise<number> {
    const ctx = this.getChain(chain);
    return await ctx.getDecimals(token);
  }

  /**
   * Fetches the balance of a given token for a wallet
   *
   * @param walletAddress The wallet address
   * @param tokenId The token ID (its home chain and address on the home chain)
   * @param chain The chain name or id
   * @returns The token balance of the wormhole asset as a BigNumber
   */
  async getBalance<C extends Chain>(
    chain: C,
    token: TokenAddress<C>,
    walletAddress: string,
  ): Promise<bigint | null> {
    const ctx = this.getChain(chain);
    return ctx.getBalance(walletAddress, token);
  }

  /**
   * Gets the associated token account for chains that require it (only Solana currently).
   *
   * @param token the TokenId of the token to get the token account for
   * @param recipient the address of the primary account that may require a separate token account
   * @returns
   */
  async getTokenAccount<C extends Chain>(
    recipient: ChainAddress<C>,
    token: TokenId<C>,
  ): Promise<ChainAddress<C>> {
    return this.getChain(recipient.chain).getTokenAccount(recipient.address, token.address);
  }

  /**
   * Gets the Raw VAA Bytes from the API or Guardian RPC, finality must be met before the VAA will be available.
   *
   * @param wormholeMessageId The WormholeMessageId corresponding to the VAA to be fetched
   * @param timeout The total amount of time to wait for the VAA to be available
   * @returns The VAA bytes if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVaaBytes(
    wormholeMessageId: WormholeMessageId,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<Uint8Array | null> {
    return await getVaaBytesWithRetry(this.config.api, wormholeMessageId, timeout);
  }

  /**
   * Gets a VAA from the API or Guardian RPC, finality must be met before the VAA will be available.
   *
   * @param id The WormholeMessageId or Transaction hash corresponding to the VAA to be fetched
   * @param decodeAs The VAA type to decode the bytes as
   * @param timeout The total amount of time to wait for the VAA to be available
   * @returns The VAA if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVaa<T extends PayloadLiteral | PayloadDiscriminator>(
    id: WormholeMessageId | TxHash,
    decodeAs: T,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<ReturnType<typeof deserialize<T>> | null> {
    if (typeof id === "string")
      return await getVaaByTxHashWithRetry(this.config.api, id, decodeAs, timeout);

    return await getVaaWithRetry(this.config.api, id, decodeAs, timeout);
  }

  /**
   * Gets if the token bridge transfer VAA has been enqueued by the Governor.
   * @param id The WormholeMessageId corresponding to the token bridge transfer VAA to check
   * @returns True if the transfer has been enqueued, false otherwise
   */
  async getIsVaaEnqueued(id: WormholeMessageId): Promise<boolean> {
    return await getIsVaaEnqueued(this.config.api, id);
  }

  /**
   * Gets the CircleAttestation corresponding to the message hash logged in the transfer transaction.
   * @param msgHash  The keccak256 hash of the message emitted by the circle contract
   * @param timeout The total amount of time to wait for the VAA to be available
   * @returns The CircleAttestation as a string, if available
   * @throws Errors if the CircleAttestation is not available after the retries
   */
  async getCircleAttestation(
    msgHash: string,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<string | null> {
    return getCircleAttestationWithRetry(this.config.circleAPI, msgHash, timeout);
  }

  /**
   * Get the status of a transaction, identified by the chain, emitter address, and sequence number
   *
   * @param id the message id for the Wormhole Message to get transaction status for or originating Transaction hash
   * @returns the TransactionStatus
   */
  async getTransactionStatus(
    id: WormholeMessageId | TxHash,
    timeout = DEFAULT_TASK_TIMEOUT,
  ): Promise<TransactionStatus | null> {
    let msgid: WormholeMessageId;
    // No txid endpoint exists to get the status by txhash yet
    if (typeof id === "string") {
      const vaa = await getVaaByTxHashWithRetry(this.config.api, id, "Uint8Array", timeout);
      if (!vaa) return null;
      msgid = { emitter: vaa.emitterAddress, chain: vaa.emitterChain, sequence: vaa.sequence };
    } else {
      msgid = id;
    }

    return await getTransactionStatusWithRetry(this.config.api, msgid, timeout);
  }

  /**
   * Get recent transactions for an address
   *
   * @param address the string formatted address to get transactions for
   * @returns the TransactionStatus
   */
  async getTransactionsForAddress(
    address: string,
    pageSize: number = 50,
    page: number = 0,
  ): Promise<TransactionStatus[] | null> {
    return getTxsByAddress(this.config.api, address, pageSize, page);
  }

  /**
   * Parse an address from its canonical string format to a NativeAddress
   *
   * @param chain The chain the address is for
   * @param address The address in canonical string format
   * @returns The address in the NativeAddress format
   */
  static parseAddress<C extends Chain>(chain: C, address: string): NativeAddress<C> {
    return toNative(chain, address);
  }

  /**
   * Return a string in the canonical chain format representing the address
   * of a token or account
   *
   * @param chainAddress The ChainAddress or TokenId to get a string address
   * @returns The string address in canonical format for the chain
   */
  static canonicalAddress(chainAddress: ChainAddress | TokenId): string {
    return canonicalAddress(chainAddress);
  }

  /**
   * Parse an address from its canonical string format to a NativeAddress
   *
   * @param chain The chain the address is for
   * @param address The native address in canonical string format
   * @returns The ChainAddress
   */
  static chainAddress<C extends Chain>(chain: C, address: string): ChainAddress<C> {
    return { chain, address: Wormhole.parseAddress(chain, address) };
  }

  /**
   * Parse an address from its canonical string format to a NativeAddress
   *
   * @param chain The chain the address is for
   * @param address The native address in canonical string format or the string "native"
   * @returns The ChainAddress
   */
  static tokenId<C extends Chain>(chain: C, address: string): TokenId<C> {
    return isNative(address) ? nativeTokenId(chain) : this.chainAddress(chain, address);
  }

  /**
   * Parses all relevant information from a transaction given the sending tx hash and sending chain
   *
   * @param chain The sending chain name or context
   * @param tx The sending transaction hash
   * @returns The parsed WormholeMessageId
   */
  static async parseMessageFromTx<N extends Network, C extends Chain>(
    chain: ChainContext<N, C>,
    txid: TxHash,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<WormholeMessageId[]> {
    const task = async () => {
      try {
        const msgs = await chain.parseTransaction(txid);
        // possible the node we hit does not have this data yet
        // return null to signal retry
        if (msgs.length === 0) return null;
        return msgs;
      } catch (e) {
        console.error(e);
        return null;
      }
    };

    const parsed = await retry<WormholeMessageId[]>(
      task,
      chain.config.blockTime,
      timeout,
      "WormholeCore:ParseMessageFromTransaction",
    );

    if (!parsed) throw new Error(`No WormholeMessageId found for ${txid}`);
    return parsed;
  }
}
