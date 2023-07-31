import { Program } from '@project-serum/anchor';
import { TokenBridge } from '@certusone/wormhole-sdk/lib/cjs/solana/types/tokenBridge';
import { NftBridge } from '@certusone/wormhole-sdk/lib/cjs/solana/types/nftBridge';
import { Wormhole as WormholeCore } from '@certusone/wormhole-sdk/lib/cjs/solana/types/wormhole';
import {
  ChainName,
  ChainId,
  Contracts,
  Context,
  Network,
  TokenBridgeRelayer,
  ContractsAbstract,
  Wormhole,
  filterByContext,
} from '@wormhole-foundation/connect-sdk';

import { createReadOnlyWormholeProgramInterface } from './utils/wormhole';
import { createReadOnlyTokenBridgeProgramInterface } from './utils/tokenBridge';
import { createReadOnlyNftBridgeProgramInterface } from './utils/nftBridge';

/**
 * @category Solana
 */
export class SolContracts extends ContractsAbstract {
  protected _contracts: Map<ChainName, any>;
  protected wormhole: Wormhole;

  constructor(wormholeBase: Wormhole) {
    super();
    this.wormhole = wormholeBase;
    const tag =
      wormholeBase.network === Network.MAINNET ? 'mainnet-beta' : 'devnet';
    this._contracts = new Map();
    const chains = filterByContext(wormholeBase.conf, Context.SOLANA);
    chains.forEach((c) => {
      this._contracts.set(c.key, c.contracts);
    });
  }

  get connection() {
    return (this.wormhole as any).connection;
  }

  getContracts(chain: ChainName | ChainId): Contracts | undefined {
    const chainName = this.wormhole.toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName | ChainId): Contracts {
    const chainName = this.wormhole.toChainName(chain);
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

    const contracts = this.wormhole.mustGetContracts('solana');
    if (!contracts.core) return;

    return createReadOnlyWormholeProgramInterface(
      contracts.core,
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

    const contracts = this.wormhole.mustGetContracts('solana');
    if (!contracts.token_bridge) return;

    return createReadOnlyTokenBridgeProgramInterface(
      contracts.token_bridge,
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

    const contracts = this.wormhole.mustGetContracts('solana');
    if (!contracts.nft_bridge) return;

    return createReadOnlyNftBridgeProgramInterface(
      contracts.nft_bridge,
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
  getTokenBridgeRelayer(
    chain?: ChainName | ChainId,
  ): TokenBridgeRelayer | undefined {
    return undefined;
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, errors if not found
   */
  mustGetTokenBridgeRelayer(chain: ChainName | ChainId): TokenBridgeRelayer {
    throw new Error('relayer not deployed on Solana');
  }
}
