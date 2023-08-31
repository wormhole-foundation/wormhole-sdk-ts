import {
  PlatformName,
  ChainName,
  Network,
  toChainId,
  isCircleChain,
  usdcContract,
} from '@wormhole-foundation/sdk-base';
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
  PlatformCtr,
  Contracts,
} from '@wormhole-foundation/sdk-definitions';
import axios, { AxiosResponse } from 'axios';

import { WormholeConfig } from './types';

import { CONFIG } from './constants';
import { TokenTransfer } from './protocols/tokenTransfer';
import { CCTPTransfer } from './protocols/cctpTransfer';
import { TransactionStatus } from './api';

export class Wormhole {
  protected _platforms: Map<PlatformName, Platform<PlatformName>>;

  readonly conf: WormholeConfig;

  constructor(
    network: Network,
    platforms: PlatformCtr<PlatformName>[],
    conf?: WormholeConfig,
  ) {
    this.conf = conf ?? CONFIG[network];

    this._platforms = new Map();
    for (const p of platforms) {
      const platformName = p._platform;

      const filteredChains = Object.fromEntries(
        Object.entries(this.conf.chains).filter(([_, v]) => {
          return v.platform == platformName;
        }),
      );

      this._platforms.set(platformName, new p(filteredChains));
    }
  }

  get network(): Network {
    return this.conf.network;
  }

  async cctpTransfer(
    amount: bigint,
    from: ChainAddress,
    to: ChainAddress,
    automatic: boolean,
    payload?: Uint8Array,
    nativeGas?: bigint,
  ): Promise<CCTPTransfer> {
    if (automatic && payload)
      throw new Error('Payload with automatic delivery is not supported');

    if (!isCircleChain(from.chain))
      throw new Error('Payload with automatic delivery is not supported');

    // TODO: ts-ignore because devnet not setup for circle stuff
    // @ts-ignore
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

  async tokenTransfer(
    token: TokenId | 'native',
    amount: bigint,
    from: ChainAddress,
    to: ChainAddress,
    automatic: boolean,
    payload?: Uint8Array,
    nativeGas?: bigint,
  ): Promise<TokenTransfer> {
    if (payload && automatic)
      throw new Error('Payload with automatic delivery is not supported');

    if (nativeGas && !automatic)
      throw new Error('Gas Dropoff is only supported for automatic transfers');

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
   * Gets the contract addresses for a given chain
   * @param chain the chain name or chain id
   * @returns the contract addresses
   * @throws Errors if contracts are not found
   */
  mustGetContracts(chain: ChainName): Contracts {
    const contracts = this.getContracts(chain);
    if (!contracts) throw new Error(`no contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns the platform "context", i.e. the class with platform-specific logic and methods
   * @param chain the chain name or chain id
   * @returns the chain context class
   * @throws Errors if context is not found
   */
  getPlatform(chain: ChainName): Platform<PlatformName> {
    const { platform: platformType } = this.conf.chains[chain]!;
    const platform = this._platforms.get(platformType);
    if (!platform) throw new Error(`Not able to retrieve platform ${platform}`);
    return platform;
  }

  /**
   * Returns the platform "context", i.e. the class with platform-specific logic and methods
   * @param chain the chain name or chain id
   * @returns the chain context class
   * @throws Errors if context is not found
   */
  getChain(chain: ChainName): ChainContext<PlatformName> {
    const platform = this.getPlatform(chain);
    return platform.getChain(chain);
  }

  /**
   * Gets the address for a token representation on any chain
   *  These are the Wormhole token addresses, not necessarily the cannonical version of that token
   *
   * @param tokenId The Token ID (chain/address)
   * @param chain The chain name or id
   * @returns The Wormhole address on the given chain, null if it does not exist
   */
  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress | null> {
    const context = this.getChain(chain);
    return await context.getForeignAsset(tokenId);
  }

  /**
   * Gets the address for a token representation on any chain
   *  These are the Wormhole token addresses, not necessarily the cannonical version of that token
   *
   * @param tokenId The Token ID (chain/address)
   * @param chain The chain name or id
   * @returns The Wormhole address on the given chain
   * @throws Throws if the token does not exist
   */
  async mustGetForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress> {
    const address = await this.getForeignAsset(tokenId, chain);
    if (!address) throw new Error('No asset registered');
    return address;
  }

  /**
   * Gets the number of decimals for a token on a given chain
   *
   * @param tokenId The Token ID (home chain/address)
   * @param chain The chain name or id of the token/representation
   * @returns The number of decimals
   */
  async getTokenDecimals(tokenId: TokenId, chain: ChainName): Promise<bigint> {
    const repr = await this.mustGetForeignAsset(tokenId, chain);
    const context = this.getChain(chain);
    return await context.getTokenDecimals(repr);
  }

  /**
   * Fetches the native token balance for a wallet
   *
   * @param walletAddress The wallet address
   * @param chain The chain name or id
   * @returns The native balance as a BigNumber
   */
  async getNativeBalance(
    walletAddress: string,
    chain: ChainName,
  ): Promise<bigint> {
    const context = this.getChain(chain);
    return await context.getNativeBalance(walletAddress);
  }

  /**
   * Fetches the balance of a given token for a wallet
   *
   * @param walletAddress The wallet address
   * @param tokenId The token ID (its home chain and address on the home chain)
   * @param chain The chain name or id
   * @returns The token balance of the wormhole asset as a BigNumber
   */
  async getTokenBalance(
    walletAddress: string,
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<bigint | null> {
    const context = this.getChain(chain);
    return await context.getTokenBalance(walletAddress, tokenId);
  }

  /**
   * Check whether a chain supports automatic relaying
   * @param chain the chain name or chain id
   * @returns boolean representing if automatic relay is available
   */
  supportsSendWithRelay(chain: ChainName): boolean {
    return !!(
      this.getContracts(chain)?.relayer &&
      'startTransferWithRelay' in this.getPlatform(chain)
    );
  }

  /**
   * Gets a VAA from the API or Guardian RPC, finality must be met before the VAA will be available.
   *  See {@link ChainConfig.finalityThreshold | finalityThreshold} on {@link CONFIG | the config}
   *
   * @param msg The MessageIdentifier used to fetch the VAA
   * @returns The ParsedVAA if available
   */
  async getVAABytes(
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<Uint8Array | undefined> {
    const chainId = toChainId(chain);
    const emitterAddress = emitter.toString().startsWith('0x')
      ? emitter.toString().slice(2)
      : emitter;

    let response: AxiosResponse<any, any> | undefined;
    // TODO: Make both data formats work
    //const url = `${this.conf.api}/api/v1/vaas/${chainId}/${emitterAddress}/${seq}`;
    const url = `https://wormhole-v2-testnet-api.certus.one/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;

    for (let i = retries; i > 0 && !response; i--) {
      // TODO: config wait seconds?
      if (i != retries) await new Promise((f) => setTimeout(f, 2000));

      try {
        response = await axios.get(url);
      } catch (e) {
        console.error(`Caught an error waiting for VAA: ${e}`);
      }
    }

    if (!response || !response.data) return;

    const { data } = response;
    return new Uint8Array(Buffer.from(data.vaaBytes, 'base64'));
  }

  /**
   * Gets a VAA from the API or Guardian RPC, finality must be met before the VAA will be available.
   *  See {@link ChainConfig.finalityThreshold | finalityThreshold} on {@link CONFIG | the config}
   *
   * @param msg The MessageIdentifier used to fetch the VAA
   * @returns The ParsedVAA if available
   */
  async getVAA(
    chain: ChainName,
    emitter: UniversalAddress,
    seq: bigint,
    retries: number = 5,
  ): Promise<VAA | undefined> {
    const vaaBytes = await this.getVAABytes(chain, emitter, seq, retries);
    if (vaaBytes === undefined) return;

    return deserialize('Uint8Array', vaaBytes);
  }

  // TODO: does this belong here?
  async getCircleAttestation(
    msgHash: string,
    retries: number = 5,
  ): Promise<string | undefined> {
    let response: AxiosResponse<any, any> | undefined;

    const url = `${this.conf.circleAPI}/${msgHash}`;

    for (let i = retries; i > 0 && !response; i--) {
      // TODO: config wait seconds?
      if (i != retries) await new Promise((f) => setTimeout(f, 2000));

      try {
        response = await axios.get(url);
      } catch (e) {
        console.error(`Caught an error waiting for Circle Attestation: ${e}`);
      }
      if (response === undefined || response.status !== 200) continue;

      const { data } = response;

      // TODO: what are the statuses? should we retry if
      if (data.status === 'complete') return data.attestation;
    }
  }

  async getTransactionStatus(
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
  ): Promise<TransactionStatus> {
    const chainId = toChainId(chain);
    const emitterAddress = emitter.toString().startsWith('0x')
      ? emitter.toString().slice(2)
      : emitter;

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

  //  /**
  //   * Checks if a transfer has been completed or not
  //   *
  //   * @param destChain The destination chain name or id
  //   * @param signedVAA The Signed VAA bytes
  //   * @returns True if the transfer has been completed, otherwise false
  //   */
  //  async isTransferCompleted(
  //    destChain: Chain,
  //    signedVaa: string,
  //  ): Promise<boolean> {
  //    const context = this.getContext(destChain);
  //    return await context.isTransferCompleted(destChain, signedVaa);
  //  }
  //
  //  /**
  //   * Format an address to a 32-byte universal address, which can be utilized by the Wormhole contracts
  //   *
  //   * @param address The address as a string
  //   * @returns The address as a 32-byte Wormhole address
  //   */
  //  formatAddress(address: string, chain: Chain): any {
  //    const context = this.getContext(chain);
  //    return context.formatAddress(address);
  //  }
  //
  //  /**
  //   * Parse an address from a 32-byte universal address to a cannonical address
  //   *
  //   * @param address The 32-byte wormhole address
  //   * @returns The address in the blockchain specific format
  //   */
  //  parseAddress(address: any, chain: Chain): string {
  //    const context = this.getContext(chain);
  //    return context.parseAddress(address);
  //  }
  //
  //  /**
  //   * Parses all relevant information from a transaction given the sending tx hash and sending chain
  //   *
  //   * @param tx The sending transaction hash
  //   * @param chain The sending chain name or id
  //   * @returns The parsed data
  //   */
  //  async parseMessageFromTx(tx: string, chain: Chain): Promise<any[]> {
  //    const context = this.getContext(chain);
  //    return await context.parseMessageFromTx(tx, chain);
  //  }
}
