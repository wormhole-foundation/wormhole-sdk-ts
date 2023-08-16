import * as ethers_contracts from './ethers-contracts';
import {
  Chain,
  ChainName,
  toChainName,
  Contracts,
  Network,
  platformToChains,
  contracts,
} from '@wormhole-foundation/sdk-base';
import { Provider } from 'ethers';

/**
 * @category EVM
 * Evm Contracts class. Contains methods for accessing ts interfaces for all available contracts
 */
export class EvmContracts {
  protected _contracts: Map<ChainName, Contracts>;

  constructor(network: Network) {
    this._contracts = new Map();
    platformToChains('Evm').forEach((c) => {
      this._contracts.set(c, contracts[network][c]);
    });
  }

  getContracts(chain: Chain): Contracts | undefined {
    const chainName = toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: Chain): Contracts {
    const contracts = this.getContracts(chain);
    if (!contracts) throw new Error(`no EVM contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, undefined if not found
   */
  getCore(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.Wormhole | undefined {
    const address = this.mustGetContracts(chain).CoreBridge;
    if (!address) return undefined;
    return ethers_contracts.Wormhole__factory.connect(address, connection);
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  mustGetCore(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.Wormhole {
    const core = this.getCore(chain, connection);
    if (!core) throw new Error(`Core contract for domain ${chain} not found`);
    return core;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, undefined if not found
   */
  getTokenBridge(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenBridgeContract | undefined {
    const address = this.mustGetContracts(chain).TokenBridge;
    if (!address) return undefined;
    return ethers_contracts.Bridge__factory.connect(address, connection);
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  mustGetTokenBridge(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenBridgeContract {
    const bridge = this.getTokenBridge(chain, connection);
    if (!bridge)
      throw new Error(`Bridge contract for domain ${chain} not found`);
    return bridge;
  }

  getTokenImplementation(
    connection: Provider,
    address: string,
  ): ethers_contracts.TokenImplementation | undefined {
    return ethers_contracts.TokenImplementation__factory.connect(
      address,
      connection,
    );
  }

  mustGetTokenImplementation(
    connection: Provider,
    address: string,
  ): ethers_contracts.TokenImplementation {
    const ti = this.getTokenImplementation(connection, address);
    if (!ti)
      throw new Error(`No token implementation available for: ${address}`);
    return ti;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, undefined if not found
   */
  getNftBridge(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.NFTBridge | undefined {
    const address = this.mustGetContracts(chain).NftBridge;
    if (!address) return undefined;
    return ethers_contracts.NFTBridge__factory.connect(address, connection);
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  mustGetNftBridge(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.NFTBridge {
    const nftBridge = this.getNftBridge(chain, connection);
    if (!nftBridge)
      throw new Error(`NFT Bridge contract for domain ${chain} not found`);
    return nftBridge;
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, undefined if not found
   */
  getTokenBridgeRelayer(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.WormholeRelayer | undefined {
    const address = this.mustGetContracts(chain).Relayer;
    if (!address) return undefined;
    return ethers_contracts.WormholeRelayer__factory.connect(
      address,
      connection,
    );
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, errors if not found
   */
  mustGetTokenBridgeRelayer(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.WormholeRelayer {
    const relayer = this.getTokenBridgeRelayer(chain, connection);
    if (!relayer)
      throw new Error(
        `Token Bridge Relayer contract for domain ${chain} not found`,
      );
    return relayer;
  }

  getImplementation(): ethers_contracts.ImplementationInterface {
    return ethers_contracts.Implementation__factory.createInterface();
  }
}
