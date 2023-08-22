import { Program } from '@project-serum/anchor';
import { TokenBridge } from '@certusone/wormhole-sdk/lib/cjs/solana/types/tokenBridge';
import { NftBridge } from '@certusone/wormhole-sdk/lib/cjs/solana/types/nftBridge';
import { Wormhole as WormholeCore } from '@certusone/wormhole-sdk/lib/cjs/solana/types/wormhole';
import {
  ChainName,
  ChainId,
  Contracts,
  toChainName,
  platformToChains,
  contracts,
  Network,
} from '@wormhole-foundation/sdk-base';

import { createReadOnlyWormholeProgramInterface } from './utils/wormhole';
import { createReadOnlyTokenBridgeProgramInterface } from './utils/tokenBridge';
import { createReadOnlyNftBridgeProgramInterface } from './utils/nftBridge';
import { Connection, clusterApiUrl } from '@solana/web3.js';

/**
 * @category Solana
 */
// TODO: create Contracts interface
export class SolanaContracts {
  protected _contracts: Map<ChainName, Contracts>;
  protected _connection: Connection;

  constructor(network: Network, connection?: Connection) {
    if (connection) {
      this._connection = connection;
    } else {
      const tag = network === 'Mainnet' ? 'mainnet-beta' : 'devnet';
      this._connection = new Connection(clusterApiUrl(tag));
    }
    this._contracts = new Map();
    platformToChains('Evm').forEach((c) => {
      this._contracts.set(c, contracts[network][c]);
    });
  }

  get connection() {
    return this._connection;
  }

  getContracts(chain: ChainName | ChainId): Contracts | undefined {
    const chainName = toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName | ChainId): Contracts {
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
  getCore(chain?: ChainName | ChainId): Program<WormholeCore> | undefined {
    if (!this.connection) throw new Error('no connection');

    const contracts = this.mustGetContracts('Solana');
    if (!contracts.CoreBridge) return;

    return createReadOnlyWormholeProgramInterface(
      contracts.CoreBridge,
      this.connection,
    );
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  mustGetCore(chain?: ChainName | ChainId): Program<WormholeCore> {
    const core = this.getCore(chain);
    if (!core) throw new Error(`Core contract for domain ${chain} not found`);
    return core;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, undefined if not found
   */
  getBridge(chain?: ChainName | ChainId): Program<TokenBridge> | undefined {
    if (!this.connection) throw new Error('no connection');

    const contracts = this.mustGetContracts('Solana');
    if (!contracts.TokenBridge) return;

    return createReadOnlyTokenBridgeProgramInterface(
      contracts.TokenBridge,
      this.connection,
    );
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  mustGetBridge(chain?: ChainName | ChainId): Program<TokenBridge> {
    const bridge = this.getBridge(chain);
    if (!bridge)
      throw new Error(`Bridge contract for domain ${chain} not found`);
    return bridge;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, undefined if not found
   */
  getNftBridge(chain?: ChainName | ChainId): Program<NftBridge> | undefined {
    if (!this.connection) throw new Error('no connection');

    const contracts = this.mustGetContracts('Solana');
    if (!contracts.NftBridge) return;

    return createReadOnlyNftBridgeProgramInterface(
      contracts.NftBridge,
      this.connection,
    );
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  mustGetNftBridge(chain: ChainName | ChainId): Program<NftBridge> {
    const nftBridge = this.getNftBridge(chain);
    if (!nftBridge)
      throw new Error(`NFT Bridge contract for domain ${chain} not found`);
    return nftBridge;
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, undefined if not found
   */
  getTokenBridgeRelayer(chain?: ChainName | ChainId): any | undefined {
    return undefined;
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, errors if not found
   */
  mustGetTokenBridgeRelayer(chain: ChainName | ChainId): any {
    throw new Error('relayer not deployed on Solana');
  }
}
