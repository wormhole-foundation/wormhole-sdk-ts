import {
  PlatformName,
  ChainName,
  Network,
  toChainId,
  isCircleSupported,
  isCircleChain,
  usdcContract,
  isChain,
  normalizeAmount,
} from "@wormhole-foundation/sdk-base";
import {
  UniversalAddress,
  deserialize,
  VAA,
  ChainAddress,
  NativeAddress,
  TokenId,
  Platform,
  ChainContext,
  toNative,
  Contracts,
  TxHash,
  WormholeMessageId,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import axios, { AxiosResponse } from "axios";

import { WormholeConfig } from "./types";

import { CONFIG, networkPlatformConfigs } from "./config";
import { TokenTransfer } from "./protocols/tokenTransfer";
import { CCTPTransfer } from "./protocols/cctpTransfer";
import { GatewayTransfer } from "./protocols/gatewayTransfer";
import { TransactionStatus } from "./api";
import { getCircleAttestation } from "./circle-api";

export class Wormhole {
  protected _platforms: Map<PlatformName, Platform<PlatformName>>;

  readonly conf: WormholeConfig;

  constructor(
    network: Network,
    platforms: Platform<PlatformName>[],
    conf?: WormholeConfig,
  ) {
    this.conf = conf ?? CONFIG[network];

    this._platforms = new Map();
    for (const p of platforms) {
      const platformName = p.platform;
      const filteredChains = networkPlatformConfigs(network, platformName);
      this._platforms.set(platformName, p.setConfig(network, filteredChains));
    }
  }

  get network(): Network {
    return this.conf.network;
  }

  /**
   * Creates a CCTPTransfer object to move Native USDC from one chain to another
   * @param amount the amount to transfer
   * @param from the address to transfer from
   * @param to the address to transfer to
   * @param automatic whether to use automatic delivery
   * @param payload the payload to send with the transfer
   * @param nativeGas the amount of native gas to send with the transfer
   * @returns the CCTPTransfer object
   * @throws Errors if the chain or protocol is not supported
   */
  async cctpTransfer(
    amount: bigint,
    from: ChainAddress,
    to: ChainAddress,
    automatic: boolean,
    payload?: Uint8Array,
    nativeGas?: bigint,
  ): Promise<CCTPTransfer> {
    if (automatic && payload)
      throw new Error("Payload with automatic delivery is not supported");

    if (
      !isCircleChain(from.chain) ||
      !isCircleChain(to.chain) ||
      !isCircleSupported(this.network, from.chain) ||
      !isCircleSupported(this.network, to.chain)
    )
      throw new Error(
        `Network and chain not supported: ${this.network} ${from.chain} `,
      );

    const contract = usdcContract(this.network, from.chain);

    const token: TokenId = {
      chain: from.chain,
      address: toNative(from.chain, contract),
    };

    return await CCTPTransfer.from(this, {
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
  ): Promise<TokenTransfer | GatewayTransfer> {
    if (payload && automatic)
      throw new Error("Payload with automatic delivery is not supported");

    if (nativeGas && !automatic)
      throw new Error("Gas Dropoff is only supported for automatic transfers");

    const fromChain = this.getChain(from.chain);
    const toChain = this.getChain(to.chain);

    if (!fromChain.supportsTokenBridge())
      throw new Error(`Token Bridge not supported on ${from.chain}`);

    if (!toChain.supportsTokenBridge())
      throw new Error(`Token Bridge not supported on ${to.chain}`);

    if (automatic && !fromChain.supportsAutomaticTokenBridge())
      throw new Error(`Automatic Token Bridge not supported on ${from.chain}`);

    // Bit of (temporary) hackery until solana contracts support being
    // sent a VAA with the primary address
    if (to.chain === "Solana") {
      // Overwrite the dest address with the ATA
      to = await this.getTokenAccount(from.chain, token, to);
    } else if (to.chain === "Sei") {
      if (payload) throw new Error("NO");

      //
      payload = Buffer.from(
        JSON.stringify({
          basic_recipient: {
            recipient: Buffer.from(to.address.toString()).toString("base64"),
          },
        }),
      );

      to = {
        chain: to.chain,
        address: toNative(
          to.chain,
          toChain.platform.conf.Sei?.contracts.translator!,
        ),
      };
    }

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
  getContracts(chain: ChainName): Contracts | undefined {
    return this.conf.chains[chain]?.contracts;
  }

  /**
   * Returns the platform object, i.e. the class with platform-specific logic and methods
   * @param chain the chain name or platform name
   * @returns the platform context class
   * @throws Errors if platform is not found
   */
  getPlatform(chain: ChainName | PlatformName): Platform<PlatformName> {
    const platformName = isChain(chain)
      ? this.conf.chains[chain]!.platform
      : chain;

    const platform = this._platforms.get(platformName);
    if (!platform) throw new Error(`Not able to retrieve platform ${platform}`);
    return platform;
  }

  /**
   * Returns the chain "context", i.e. the class with chain-specific logic and methods
   * @param chain the chain name
   * @returns the chain context class
   * @throws Errors if context is not found
   */
  getChain(chain: ChainName): ChainContext<PlatformName> {
    const platform = this.getPlatform(chain);
    return platform.getChain(chain);
  }

  /**
   * Gets the TokenId for a token representation on any chain
   *  These are the Wormhole wrapped token addresses, not necessarily
   *  the cannonical version of that token
   *
   * @param tokenId The Token ID (chain/address)
   * @param chain The chain name or id
   * @returns The TokenId on the given chain, null if it does not exist
   * @throws Errors if the chain is not supported or the token does not exist
   */
  async getWrappedAsset(chain: ChainName, token: TokenId): Promise<TokenId> {
    const ctx = this.getChain(chain);
    const tb = await ctx.getTokenBridge();
    return { chain, address: await tb.getWrappedAsset(token) };
  }

  /**
   * Gets the number of decimals for a token on a given chain
   *
   * @param tokenId The Token ID (home chain/address)
   * @param chain The chain name or id of the token/representation
   * @returns The number of decimals
   */
  async getDecimals(
    chain: ChainName,
    token: TokenId | "native",
  ): Promise<bigint> {
    const ctx = this.getChain(chain);
    return await ctx.getDecimals(token);
  }

  /**
   * Converts a human friendly decimal number to base units for the token passed
   *
   * @param chain The chain name
   * @param tokenId The token ID (its home chain and address on the home chain) or 'native'
   * @param amount The decimal number as a string to convert into base units
   * @returns The amount converted to base units as a BigNumber
   */
  async normalizeAmount(
    chain: ChainName,
    token: TokenId | "native",
    amount: number | string,
  ): Promise<bigint> {
    const ctx = this.getChain(chain);
    let decimals = await ctx.getDecimals(token);
    return normalizeAmount(amount, decimals);
  }

  /**
   * Fetches the balance of a given token for a wallet
   *
   * @param walletAddress The wallet address
   * @param tokenId The token ID (its home chain and address on the home chain)
   * @param chain The chain name or id
   * @returns The token balance of the wormhole asset as a BigNumber
   */
  async getBalance(
    chain: ChainName,
    token: string | TokenId | "native",
    walletAddress: string,
  ): Promise<bigint | null> {
    const ctx = this.getChain(chain);

    if (typeof token === "string" && token !== "native") {
      token = { chain: chain, address: toNative(chain, token) };
    }

    return ctx.getBalance(walletAddress, token);
  }

  /**
   * Gets the associated token account for chains that require it (only Solana currently).
   * @param sendingChain the chain name of the source token
   * @param sendingToken the TokenId or address of the source token
   * @param recipient the address of the recipient
   * @returns
   */
  async getTokenAccount(
    sendingChain: ChainName,
    sendingToken:
      | UniversalAddress
      | NativeAddress<PlatformName>
      | TokenId
      | "native",
    recipient: ChainAddress,
  ): Promise<ChainAddress> {
    // TODO: same as supportsSendWithRelay, need some
    // way to id this in a less sketchy way
    const chain = this.getChain(recipient.chain);
    if ("getTokenAccount" in chain) {
      let t: TokenId;
      if (sendingToken === "native") {
        const srcTb = await this.getChain(sendingChain).getTokenBridge();
        t = { chain: sendingChain, address: await srcTb.getWrappedNative() };
      } else {
        t = isTokenId(sendingToken)
          ? sendingToken
          : {
              chain: sendingChain,
              address: (
                sendingToken as UniversalAddress | NativeAddress<PlatformName>
              ).toUniversalAddress(),
            };
      }

      const dstTokenBridge = await chain.getTokenBridge();
      const dstNative = await dstTokenBridge.getWrappedAsset(t);

      return {
        chain: recipient.chain,
        // @ts-ignore
        address: await chain.getTokenAccount(dstNative, recipient.address),
      } as ChainAddress;
    }

    return recipient;
  }

  /**
   * Gets the Raw VAA Bytes from the API or Guardian RPC, finality must be met before the VAA will be available.
   * @param chain The chain name
   * @param emitter The emitter address
   * @param sequence The sequence number
   * @param retries The number of times to retry
   * @returns The VAA bytes if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVAABytes(
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<Uint8Array | undefined> {
    const chainId = toChainId(chain);
    const emitterAddress = emitter.toUniversalAddress().toString();

    let response: AxiosResponse<any, any> | undefined;
    const url = `${this.conf.api}/api/v1/vaas/${chainId}/${emitterAddress}/${sequence}`;

    for (let i = retries; i > 0 && !response; i--) {
      if (i != retries) await new Promise((f) => setTimeout(f, 2000));

      try {
        response = await axios.get(url);
      } catch (e) {
        console.error(`Caught an error waiting for VAA: ${e}\n${url}\n`);
      }
    }
    if (!response || !response.data) return;

    const { data } = response;

    return new Uint8Array(Buffer.from(data.data.vaa, "base64"));

    // TODO: Make both data formats work
    // const url = `https://wormhole-v2-testnet-api.certus.one/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;
    //return new Uint8Array(Buffer.from(data.vaaBytes, 'base64'));
  }

  /**
   * Gets a VAA from the API or Guardian RPC, finality must be met before the VAA will be available.
   * @param chain The chain name
   * @param emitter The emitter address
   * @param sequence The sequence number
   * @param retries The number of times to retry
   * @returns The VAA if available
   * @throws Errors if the VAA is not available after the retries
   */
  async getVAA(
    chain: ChainName,
    emitter: UniversalAddress,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA | undefined> {
    const vaaBytes = await this.getVAABytes(chain, emitter, sequence, retries);
    if (vaaBytes === undefined) return;

    return deserialize("Uint8Array", vaaBytes);
  }

  async getCircleAttestation(msgHash: string): Promise<string | null> {
    const attest = await getCircleAttestation(this.conf.circleAPI, msgHash);
    if (attest !== null) return attest.message;
    return null;
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
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
  ): Promise<TransactionStatus> {
    const chainId = toChainId(chain);
    const emitterAddress = emitter.toUniversalAddress().toString();
    const id = `${chainId}/${emitterAddress}/${sequence}`;

    const url = `${this.conf.api}/api/v1/transactions/${id}`;

    // TODO: try/catch this
    const response = await axios.get(url);

    if (!response || !response.data)
      throw new Error(`No data available for sequence: ${id}`);

    const { data } = response;

    // TODO: actually check this data
    return data as TransactionStatus;
  }

  /**
   * Parse an address to a universal address
   *
   * @param address The native address
   * @returns The address in the universal format
   */
  parseAddress(chain: ChainName, address: string): NativeAddress<PlatformName> {
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
    chain: ChainName,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    return await this.getChain(chain).parseTransaction(txid);
  }
}
