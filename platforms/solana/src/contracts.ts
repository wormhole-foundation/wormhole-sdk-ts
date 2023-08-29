import { Connection } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { Contracts, ChainsConfig } from '@wormhole-foundation/connect-sdk';
import { ChainName, toChainName } from '@wormhole-foundation/sdk-base';

import { TokenBridge } from './utils/types/tokenBridge';
import { createReadOnlyTokenBridgeProgramInterface } from './utils/tokenBridge';

import { Wormhole as WormholeCore } from './utils/types/wormhole';
import { createReadOnlyWormholeProgramInterface } from './utils/wormhole';

import { NftBridge } from './utils/types/nftBridge';
import { createReadOnlyNftBridgeProgramInterface } from './utils/nftBridge';

/**
 * @category Solana
 */
export class SolanaContracts {
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
    const chainName = toChainName(chain);
    const contracts = this._contracts.get(chainName);
    if (!contracts) throw new Error(`no Solana contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, undefined if not found
   */
  getCore(
    chain: ChainName,
    connection: Connection,
  ): Program<WormholeCore> | undefined {
    const contracts = this.mustGetContracts(chain);
    if (!contracts.coreBridge) return;

    return createReadOnlyWormholeProgramInterface(
      contracts.coreBridge,
      connection,
    );
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  mustGetCore(chain: ChainName, connection: Connection): Program<WormholeCore> {
    const core = this.getCore(chain, connection);
    if (!core) throw new Error(`Core contract for domain ${chain} not found`);
    return core;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, undefined if not found
   */
  getBridge(
    chain: ChainName,
    connection: Connection,
  ): Program<TokenBridge> | undefined {
    const contracts = this.mustGetContracts(chain);
    if (!contracts.tokenBridge) return;

    return createReadOnlyTokenBridgeProgramInterface(
      contracts.tokenBridge,
      connection,
    );
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  mustGetBridge(
    chain: ChainName,
    connection: Connection,
  ): Program<TokenBridge> {
    const bridge = this.getBridge(chain, connection);
    if (!bridge)
      throw new Error(`Bridge contract for domain ${chain} not found`);
    return bridge;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, undefined if not found
   */
  getNftBridge(
    chain: ChainName,
    connection: Connection,
  ): Program<NftBridge> | undefined {
    const contracts = this.mustGetContracts(chain);
    if (!contracts.nftBridge) return;

    return createReadOnlyNftBridgeProgramInterface(
      contracts.nftBridge,
      connection,
    );
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  mustGetNftBridge(
    chain: ChainName,
    connection: Connection,
  ): Program<NftBridge> {
    const nftBridge = this.getNftBridge(chain, connection);
    if (!nftBridge)
      throw new Error(`NFT Bridge contract for domain ${chain} not found`);
    return nftBridge;
  }
}
