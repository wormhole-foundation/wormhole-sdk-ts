import { Connection } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import {
  Contracts,
  ChainsConfig,
  ChainName,
} from '@wormhole-foundation/connect-sdk';

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

  getContracts(chain: ChainName): Contracts {
    const contracts = this._contracts.get(chain);
    if (!contracts) throw new Error(`no Solana contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  getCore(chain: ChainName, connection: Connection): Program<WormholeCore> {
    const contracts = this.getContracts(chain);
    if (!contracts.coreBridge) throw new Error(`Core contract for domain ${chain} not found`);

    return createReadOnlyWormholeProgramInterface(
      contracts.coreBridge,
      connection,
    );
    // const core = this.getCore(chain, connection);
    // if (!core) throw new Error(`Core contract for domain ${chain} not found`);
    // return core;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  getTokenBridge(
    chain: ChainName,
    connection: Connection,
  ): Program<TokenBridge> {
    const contracts = this.getContracts(chain);
    if (!contracts.tokenBridge)
      throw new Error(`Bridge contract for domain ${chain} not found`);

    return createReadOnlyTokenBridgeProgramInterface(
      contracts.tokenBridge,
      connection,
    );
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  getNftBridge(
    chain: ChainName,
    connection: Connection,
  ): Program<NftBridge> {
    const contracts = this.getContracts(chain);
    if (!contracts.nftBridge)
      throw new Error(`NFT Bridge contract for domain ${chain} not found`);

    return createReadOnlyNftBridgeProgramInterface(
      contracts.nftBridge,
      connection,
    );
  }
}
