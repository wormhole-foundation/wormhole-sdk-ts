import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  PlatformToChains,
  chainToPlatform,
  circle,
} from "@wormhole-foundation/sdk-base";
import {
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
  WormholeMessageId,
  deserialize,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { getCircleAttestationWithRetry } from "./circle-api";
import { ConfigOverrides, DEFAULT_TASK_TIMEOUT, WormholeConfig, applyOverrides } from "./config";
import { CircleTransfer } from "./protocols/cctpTransfer";
import { TokenTransfer } from "./protocols/tokenTransfer";
import { retry } from "./tasks";
import {
  TransactionStatus,
  getTransactionStatusWithRetry,
  getTxsByAddress,
  getVaaByTxHashWithRetry,
  getVaaBytesWithRetry,
  getVaaWithRetry,
} from "./whscan-api";

type PlatformMap<N extends Network, P extends Platform = Platform> = Map<P, PlatformContext<N, P>>;
type ChainMap<N extends Network, C extends Chain = Chain> = Map<
  C,
  ChainContext<N, ChainToPlatform<C>, C>
>;

export class Wormhole<N extends Network> {
  protected readonly _network: N;
  protected _platforms: PlatformMap<N>;
  protected _chains: ChainMap<N>;

  readonly config: WormholeConfig;

  constructor(network: N, platforms: PlatformUtils<N, any>[], config?: ConfigOverrides) {
    this._network = network;
    this.config = applyOverrides(network, config);

    this._chains = new Map();
    this._platforms = new Map();
    for (const p of platforms) {
      this._platforms.set(p._platform, new p(network));
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
      !circle.isCircleChain(from.chain) ||
      !circle.isCircleChain(to.chain) ||
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
    token: TokenId | "native",
    amount: bigint,
    from: ChainAddress,
    to: ChainAddress,
    automatic: boolean,
    payload?: Uint8Array,
    nativeGas?: bigint,
  ): Promise<TokenTransfer<N>> {
    // TODO: check if `toChain` is gateway supported
    // not enough to check if its a Cosmos chain since Terra/Xpla/Sei are not supported
    // if (chainToPlatform(to.chain) === 'Cosmwasm' ) {
    //   return await GatewayTransfer.from(this, {
    //     token,
    //     amount,
    //     from,
    //     to,
    //     payload,
    //     nativeGas,
    //   });
    // }

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
   * Gets the contract addresses for a given chain
   * @param chain the chain name or chain id
   * @returns the contract addresses
   */
  getContracts(chain: Chain): Contracts | undefined {
    return this.config.chains[chain]?.contracts;
  }

  /**
   * Returns the platform object, i.e. the class with platform-specific logic and methods
   * @param chain the chain name or platform name
   * @returns the platform context class
   * @throws Errors if platform is not found
   */
  getPlatform<P extends Platform>(platformName: P): PlatformContext<N, P> {
    const platform = this._platforms.get(platformName);
    if (!platform) throw new Error(`Not able to retrieve platform ${platform}`);
    return platform as PlatformContext<N, P>;
  }

  /**
   * Returns the chain "context", i.e. the class with chain-specific logic and methods
   * @param chain the chain name
   * @returns the chain context class
   * @throws Errors if context is not found
   */
  getChain<C extends Chain, P extends ChainToPlatform<C>>(chain: C): ChainContext<N, P, C> {
    const platform = chainToPlatform(chain);
    if (!this._chains.has(chain))
      this._chains.set(chain, this.getPlatform(platform).getChain(chain));
    return this._chains.get(chain)! as ChainContext<N, P, C>;
  }

  /**
   * Gets the TokenId for a token representation on any chain
   *  These are the Wormhole wrapped token addresses, not necessarily
   *  the cannonical version of that token
   *
   * @param chain The chain name or id to get the wrapped token address
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
   *  Taking a  the original TokenId for some wrapped token  chain
   *  These are the Wormhole wrapped token addresses, not necessarily
   *  the cannonical version of that token
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
   * Gets the number of decimals for a token on a given chain
   *
   * @param chain The chain name or id of the token/representation
   * @param token The token address
   * @returns The number of decimals
   */
  async getDecimals<C extends Chain>(chain: C, token: TokenAddress<C>): Promise<bigint> {
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
   * @param wormholeMessageId The WormholeMessageId corresponding to the VAA to be fetched
   * @param decodeAs The VAA type to decode the bytes as
   * @param timeout The total amount of time to wait for the VAA to be available
   * @returns The VAA if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVaa<T extends PayloadLiteral | PayloadDiscriminator>(
    wormholeMessageId: WormholeMessageId,
    decodeAs: T,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<ReturnType<typeof deserialize<T>> | null> {
    return await getVaaWithRetry(this.config.api, wormholeMessageId, decodeAs, timeout);
  }

  /**
   * Gets a VAA from the API or Guardian RPC, finality must be met before the VAA will be available.
   * @param txid The Transaction Hash corresponding to the transaction that cause the wormhole core contract to emit a vaa
   * @param decodeAs The VAA type to decode the bytes as
   * @param timeout The total amount of time to wait for the VAA to be available
   * @returns The VAA if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVaaByTxHash<T extends PayloadLiteral | PayloadDiscriminator>(
    txid: TxHash,
    decodeAs: T,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<ReturnType<typeof deserialize<T>> | null> {
    return await getVaaByTxHashWithRetry(this.config.api, txid, decodeAs, timeout);
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
   * @param wormholeMessageId the message id for the Wormhole Message to get transaction status for
   * @returns the TransactionStatus
   */
  async getTransactionStatus(
    wormholeMessageId: WormholeMessageId,
    timeout = DEFAULT_TASK_TIMEOUT,
  ): Promise<TransactionStatus | null> {
    return getTransactionStatusWithRetry(this.config.api, wormholeMessageId, timeout);
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
   * Parse an address from its canonincal string format to a NativeAddress
   *
   * @param chain The chain the address is for
   * @param address The address in canonical string format
   * @returns The address in the NativeAddress format
   */
  static parseAddress<C extends Chain>(chain: C, address: string): NativeAddress<C> {
    return toNative(chain, address);
  }

  /**
   * Parse an address from its canonincal string format to a NativeAddress
   *
   * @param chain The chain the address is for
   * @param address The native address in canonical string format
   * @returns The ChainAddress
   */
  static chainAddress<C extends Chain>(chain: C, address: string): ChainAddress<C> {
    return { chain, address: Wormhole.parseAddress(chain, address) };
  }

  /**
   * Parses all relevant information from a transaction given the sending tx hash and sending chain
   *
   * @param chain The sending chain name or context
   * @param tx The sending transaction hash
   * @returns The parsed WormholeMessageId
   */
  static async parseMessageFromTx<
    N extends Network,
    P extends Platform,
    C extends PlatformToChains<P>,
  >(
    chain: ChainContext<N, P, C>,
    txid: TxHash,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<WormholeMessageId[]> {
    const task = async () => {
      const msgs = await chain.parseTransaction(txid);
      // possible the node we hit does not have this data yet
      // return null to signal retry
      if (msgs.length === 0) return null;
      return msgs;
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
