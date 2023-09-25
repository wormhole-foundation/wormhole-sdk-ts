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

  getContracts(chain: ChainName): Contracts {
    const contracts = this.getContracts(chain);
    if (!contracts) throw new Error(`no EVM contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  getCore(chain: ChainName, connection: Provider): string {
    const address = this.getContracts(chain).coreBridge;
    if (!address) throw new Error(`Core contract for domain ${chain} not found`);
    return address;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  getTokenBridge(chain: ChainName, connection: Provider): string {
    const address = this.getContracts(chain).tokenBridge;
    if (!address)
      throw new Error(`Bridge contract for domain ${chain} not found`);
    return address;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  getNftBridge(chain: ChainName, connection: Provider): string {
    const address = this.getContracts(chain).nftBridge;
    if (!address)
      throw new Error(`NFT Bridge contract for domain ${chain} not found`);
    return address;
  }

  async getNativeWrapped(
    chain: ChainName,
    connection: Provider
  ): Promise<TokenId> {
    throw new Error("Not implemented");
    // const address = toNative(
    //  chain,
    //  await this.getTokenBridge(chain, connection).WETH()
    // );
    // return { address, chain };
  }
}
