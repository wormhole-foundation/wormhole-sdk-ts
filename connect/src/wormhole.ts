import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  chainToPlatform,
  circle,
} from "@wormhole-foundation/sdk-base";
import {
  AccountAddress,
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
  toNative,
} from "@wormhole-foundation/sdk-definitions";

import {
  CIRCLE_RETRY_INTERVAL,
  CONFIG,
  DEFAULT_TASK_TIMEOUT,
  WHSCAN_RETRY_INTERVAL,
} from "./config";
import { WormholeConfig } from "./types";

import { CircleTransfer } from "./protocols/cctpTransfer";
import { TokenTransfer } from "./protocols/tokenTransfer";

import { getCircleAttestation } from "./circle-api";
import { retry } from "./tasks";
import {
  TransactionStatus,
  getTransactionStatus,
  getVaaBytesWithRetry,
  getVaaWithRetry,
} from "./whscan-api";

export class Wormhole<N extends Network> {
  protected readonly _network: N;
  protected _platforms: Map<Platform, PlatformContext<N, Platform>>;
  protected _chains: Map<Chain, ChainContext<N, Platform, Chain>>;

  readonly config: WormholeConfig;

  constructor(network: N, platforms: PlatformUtils<N, any>[], config?: WormholeConfig) {
    this._network = network;
    this.config = config ?? CONFIG[network];

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
  async getTokenAccount<SC extends Chain, RC extends Chain>(
    recipient: ChainAddress<RC>,
    token: TokenId<SC>,
  ): Promise<ChainAddress<RC>> {
    const chain = this.getChain(recipient.chain);
    const tb = await chain.getTokenBridge();
    const recipientLocal = {
      chain: recipient.chain,
      address: await tb.getWrappedAsset(token),
    };

    return chain.getTokenAccount(recipient.address, recipientLocal);
  }

  /**
   * Gets the Raw VAA Bytes from the API or Guardian RPC, finality must be met before the VAA will be available.
   * @param chain The chain name
   * @param emitter The emitter address
   * @param sequence The sequence number
   * @param retries The number of times to retry
   * @param opts The options for the request. Timeouts must be set in ms.
   * @returns The VAA bytes if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVaaBytes<C extends Chain>(
    chain: C,
    emitter: AccountAddress<C>,
    sequence: bigint,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<Uint8Array | undefined> {
    return getVaaBytesWithRetry(
      this.config.api,
      {
        chain,
        sequence,
        emitter: emitter.toUniversalAddress(),
      },
      timeout,
    );
  }

  /**
   * Gets a VAA from the API or Guardian RPC, finality must be met before the VAA will be available.
   * @param chain The chain name
   * @param emitter The emitter address
   * @param sequence The sequence number
   * @param timeout The total amount of time to wait for the VAA to be available
   * @returns The VAA if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVaa<T extends PayloadLiteral | PayloadDiscriminator, C extends Chain>(
    chain: C,
    emitter: AccountAddress<C>,
    sequence: bigint,
    decodeAs: T,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<ReturnType<typeof deserialize<T>> | undefined> {
    return getVaaWithRetry(
      this.config.api,
      {
        chain,
        sequence,
        emitter: emitter.toUniversalAddress(),
      },
      decodeAs,
      timeout,
    );
  }

  async getCircleAttestation(
    msgHash: string,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<string | null> {
    const task = () => getCircleAttestation(this.config.circleAPI, msgHash);
    return retry<string>(task, CIRCLE_RETRY_INTERVAL, timeout, "Circle:GetAttestation");
  }

  /**
   * Get the status of a transaction, identified by the chain, emitter address, and sequence number
   *
   * @param chain the chain name
   * @param emitter the emitter address
   * @param sequence the sequence number
   * @returns the TransactionStatus
   */

  async getTransactionStatus(
    chain: Chain,
    emitter: UniversalAddress | NativeAddress<Platform>,
    sequence: bigint,
    timeout = DEFAULT_TASK_TIMEOUT,
  ): Promise<TransactionStatus> {
    const whm = {
      chain,
      emitter,
      sequence,
    } as WormholeMessageId;

    const task = () => getTransactionStatus(this.config.api, whm);

    const status = await retry<TransactionStatus>(
      task,
      WHSCAN_RETRY_INTERVAL,
      timeout,
      "Wormholescan:TransactionStatus",
    );
    if (!status) throw new Error(`No data available for : ${whm}`);
    return status;
  }

  /**
   * Parse an address to a universal address
   *
   * @param address The native address
   * @returns The address in the universal format
   */
  parseAddress<C extends Chain>(chain: C, address: string): NativeAddress<C> {
    return toNative(chain, address);
  }

  /**
   * Parses all relevant information from a transaction given the sending tx hash and sending chain
   *
   * @param tx The sending transaction hash
   * @param chain The sending chain name or id
   * @returns The parsed WormholeMessageId
   */
  async parseMessageFromTx(
    chain: Chain,
    txid: TxHash,
    timeout?: number,
  ): Promise<WormholeMessageId[]> {
    const originChain = this.getChain(chain);

    const task = async () => {
      const msgs = await originChain.parseTransaction(txid);
      // possible the node we hit does not have this data yet
      // return null to signal retry
      if (msgs.length === 0) return null;
      return msgs;
    };

    const parsed = await retry<WormholeMessageId[]>(
      task,
      originChain.config.blockTime,
      timeout,
      "WormholeCore:ParseMessageFromTransaction",
    );

    if (!parsed) throw new Error(`No WormholeMessageId found for ${txid}`);
    if (parsed.length != 1) throw new Error(`Expected a single VAA, got ${parsed.length}`);

    return parsed;
  }
}
