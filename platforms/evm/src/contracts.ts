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
  getCore(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.Wormhole | undefined {
    const address = this.mustGetContracts(chain).coreBridge;
    if (typeof address !== 'string') return undefined;
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
    const address = this.mustGetContracts(chain).tokenBridge;
    if (typeof address !== 'string') return undefined;
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
    const address = this.mustGetContracts(chain).nftBridge;
    if (typeof address !== 'string') return undefined;
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
  ): ethers_contracts.TokenBridgeRelayer | undefined {
    const address = this.mustGetContracts(chain).relayer;
    if (typeof address !== 'string') return undefined;

    return ethers_contracts.TokenBridgeRelayer__factory.connect(
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
  ): ethers_contracts.TokenBridgeRelayer {
    const relayer = this.getTokenBridgeRelayer(chain, connection);
    if (!relayer)
      throw new Error(
        `Token Bridge Relayer contract for domain ${chain} not found`,
      );
    return relayer;
  }

  /**
   * Returns wormhole CCTP relayer contract for the chain
   *
   * @returns An interface for the Wormhole CCTP relayer contract, undefined if not found
   */
  getWormholeCircleRelayer(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.CircleRelayer | undefined {
    const relayerAddress = this.mustGetContracts(chain).cctp.wormholeRelayer;
    if (!relayerAddress) return undefined;
    return ethers_contracts.CircleRelayer__factory.connect(
      relayerAddress,
      connection,
    );
  }

  /**
   * Returns wormhole CCTP relayer contract for the chain
   *
   * @returns An interface for the Wormhole CCTP relayer contract, errors if not found
   */
  mustGetWormholeCircleRelayer(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.CircleRelayer {
    const circleRelayer = this.getWormholeCircleRelayer(chain, connection);
    if (!circleRelayer)
      throw new Error(
        `Wormhole Circle relayer contract for domain ${chain} not found`,
      );
    return circleRelayer;
  }

  getCircleTokenMessenger(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenMessenger.TokenMessenger | undefined {
    const address = this.mustGetContracts(chain).cctp.tokenMessenger;
    if (!address) return undefined;
    return ethers_contracts.TokenMessenger__factory.connect(
      address,
      connection,
    );
  }

  mustGetCircleTokenMessenger(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.TokenMessenger.TokenMessenger {
    const ctm = this.getCircleTokenMessenger(chain, connection);
    if (!ctm)
      throw new Error(
        `Circle Token Messenger contract for domain ${chain} not found`,
      );
    return ctm;
  }

  getCircleMessageTransmitter(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.MessageTransmitter.MessageTransmitter | undefined {
    const address = this.mustGetContracts(chain).cctp.messageTransmitter;
    if (!address) return undefined;
    return ethers_contracts.MessageTransmitter__factory.connect(
      address,
      connection,
    );
  }

  mustGetCircleMessageTransmitter(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.MessageTransmitter.MessageTransmitter {
    const cmt = this.getCircleMessageTransmitter(chain, connection);
    if (!cmt)
      throw new Error(
        `Circle Messenge Transmitter contract for domain ${chain} not found`,
      );
    return cmt;
  }

  getCoreImplementationInterface(): ethers_contracts.ImplementationInterface {
    return ethers_contracts.Implementation__factory.createInterface();
  }

  getCoreImplementation(
    chain: ChainName,
    connection: Provider,
  ): ethers_contracts.Implementation {
    const address = this.mustGetContracts(chain).coreBridge;
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
      await this.mustGetTokenBridge(chain, connection).WETH(),
    );
    return { address, chain };
  }
}
