import {
  ChainName,
  toChainName,
  ChainsConfig,
  Contracts,
  TokenId,
  toNative,
} from '@wormhole-foundation/connect-sdk';
import * as ethers_contracts from './ethers-contracts';
import { Provider } from 'ethers';

/**
 * @category EVM
 * Evm Contracts class. Contains methods for accessing ts interfaces for all available contracts
 */
export class EvmContracts {
  protected _contracts: Map<ChainName, Contracts>;

  constructor(conf: ChainsConfig) {
    this._contracts = new Map();
    Object.entries(conf).forEach(([c, cfg]) => {
      this._contracts.set(c as ChainName, cfg.contracts);
    });
  }

  /**
   * Returns contract addresses for the chain
   *
   * @returns The contract addresses
   */
  getContracts(chain: ChainName): Contracts {
    const chainName = toChainName(chain);
    const contracts = this._contracts.get(chainName);
    if (!contracts) throw new Error(`no EVM contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  getCore(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.Wormhole {
    const address = this.getContracts(chain).coreBridge;
    if (!address) throw new Error(`Core contract for domain ${chain} not found`);;
    return ethers_contracts.Wormhole__factory.connect(address, connection);
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  getTokenBridge(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenBridgeContract {
    const address = this.getContracts(chain).tokenBridge;
    if (!address) throw new Error(`Bridge contract for domain ${chain} not found`);;
    return ethers_contracts.Bridge__factory.connect(address, connection);
  }

  static getTokenImplementation(
    connection: Provider,
    address: string,
  ): ethers_contracts.TokenImplementation {
    const ti = ethers_contracts.TokenImplementation__factory.connect(
      address,
      connection,
    );
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
    const address = this.getContracts(chain).nftBridge;
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
   * @returns An interface for the Token Bridge Relayer contract, errors if not found
   */
  getTokenBridgeRelayer(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenBridgeRelayer {
    const address = this.getContracts(chain).relayer;
    if (!address)
      throw new Error(
        `Token Bridge Relayer contract for domain ${chain} not found`,
      );

    return ethers_contracts.TokenBridgeRelayer__factory.connect(
      address,
      connection,
    );
  }

  /**
   * Returns wormhole CCTP relayer contract for the chain
   *
   * @returns An interface for the Wormhole CCTP relayer contract, errors if not found
   */
  getWormholeCircleRelayer(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.CircleRelayer {
    const relayerAddress = this.getContracts(chain).cctp?.wormholeRelayer;
    if (!relayerAddress)
      throw new Error(
        `Wormhole Circle relayer contract for domain ${chain} not found`,
      );
    return ethers_contracts.CircleRelayer__factory.connect(
      relayerAddress,
      connection,
    );
  }

  getCircleTokenMessenger(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenMessenger.TokenMessenger {
    const address = this.getContracts(chain).cctp!.tokenMessenger;
    if (!address)
      throw new Error(
        `Circle Token Messenger contract for domain ${chain} not found`,
      );
    return ethers_contracts.TokenMessenger__factory.connect(
      address,
      connection,
    );
  }

  getCircleMessageTransmitter(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.MessageTransmitter.MessageTransmitter {
    const address = this.getContracts(chain).cctp?.messageTransmitter;
    if (!address)
      throw new Error(
        `Circle Messenge Transmitter contract for domain ${chain} not found`,
      );
    return ethers_contracts.MessageTransmitter__factory.connect(
      address,
      connection,
    );
  }

  getCoreImplementationInterface(): ethers_contracts.ImplementationInterface {
    return ethers_contracts.Implementation__factory.createInterface();
  }

  getCoreImplementation(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.Implementation {
    const address = this.getContracts(chain).coreBridge;
    if (!address) throw new Error('Core bridge address not found');
    return ethers_contracts.Implementation__factory.connect(
      address,
      connection,
    );
  }

  async getNativeWrapped(
    chain: ChainName,
    connection: Provider,
  ): Promise<TokenId> {
    const address = toNative(
      chain,
      await this.getTokenBridge(chain, connection).WETH(),
    );
    return { address, chain };
  }
}
