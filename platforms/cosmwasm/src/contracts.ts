import {
  ChainName,
  toChainName,
  ChainsConfig,
  Contracts,
  TokenId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import { Provider } from "ethers";

/**
 * @category Cosmwasm
 * Cosmwasm Contracts class. Contains methods for accessing ts interfaces for all available contracts
 */
export class CosmwasmContracts {
  protected _contracts: Map<ChainName, Contracts>;

  constructor(conf: ChainsConfig) {
    this._contracts = new Map();
    Object.entries(conf).forEach(([c, cfg]) => {
      this._contracts.set(c as ChainName, cfg.contracts);
    });
  }

  getContracts(chain: ChainName): Contracts | undefined {
    const chainName = toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName): Contracts {
    const contracts = this.getContracts(chain);
    if (!contracts) throw new Error(`no EVM contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, undefined if not found
   */
  getCore(chain: ChainName, connection: Provider): string | undefined {
    const address = this.mustGetContracts(chain).coreBridge;
    if (typeof address !== "string") return undefined;
    return address;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  mustGetCore(chain: ChainName, connection: Provider): string {
    const core = this.getCore(chain, connection);
    if (!core) throw new Error(`Core contract for domain ${chain} not found`);
    return core;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, undefined if not found
   */
  getTokenBridge(chain: ChainName, connection: Provider): string | undefined {
    const address = this.mustGetContracts(chain).tokenBridge;
    if (typeof address !== "string") return undefined;
    return address;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  mustGetTokenBridge(chain: ChainName, connection: Provider): string {
    const bridge = this.getTokenBridge(chain, connection);
    if (!bridge)
      throw new Error(`Bridge contract for domain ${chain} not found`);
    return bridge;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, undefined if not found
   */
  getNftBridge(chain: ChainName, connection: Provider): string | undefined {
    const address = this.mustGetContracts(chain).nftBridge;
    if (typeof address !== "string") return undefined;
    return address;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  mustGetNftBridge(chain: ChainName, connection: Provider): string {
    const nftBridge = this.getNftBridge(chain, connection);
    if (!nftBridge)
      throw new Error(`NFT Bridge contract for domain ${chain} not found`);
    return nftBridge;
  }

  async getNativeWrapped(
    chain: ChainName,
    connection: Provider
  ): Promise<TokenId> {
    throw new Error("Not implemented");
    //const address = toNative(
    //  chain,
    //  await this.mustGetTokenBridge(chain, connection).WETH()
    //);
    //return { address, chain };
  }
}
