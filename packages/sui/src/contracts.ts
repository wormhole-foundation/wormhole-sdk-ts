import {
  ChainName,
  ChainId,
  Contracts,
  Context,
  ContractsAbstract,
  Wormhole,
  filterByContext,
} from '@wormhole-foundation/connect-sdk';
import { JsonRpcProvider } from '@mysten/sui.js';
import { SuiRelayer } from './relayer';

/**
 * @category Sui
 */
export class SuiContracts extends ContractsAbstract {
  protected _contracts: Map<ChainName, any>;
  protected wormhole: Wormhole;
  readonly provider: JsonRpcProvider;

  constructor(wormholeBase: Wormhole, provider: JsonRpcProvider) {
    super();
    this.wormhole = wormholeBase;
    this.provider = provider;
    this._contracts = new Map();
    const chains = filterByContext(wormholeBase.conf, Context.SUI);
    chains.forEach((c) => {
      this._contracts.set(c.key, c.contracts);
    });
  }

  getContracts(chain: ChainName | ChainId): Contracts | undefined {
    const chainName = this.wormhole.toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName | ChainId): Contracts {
    const chainName = this.wormhole.toChainName(chain);
    const contracts = this._contracts.get(chainName);
    if (!contracts) throw new Error(`no Sui contracts found for ${chain}`);
    return contracts;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, undefined if not found
   */
  getCore(chain: ChainName | ChainId) {
    return undefined;
  }

  /**
   * Returns core wormhole contract for the chain
   *
   * @returns An interface for the core contract, errors if not found
   */
  mustGetCore(chain: ChainName | ChainId) {
    throw new Error('not implemented');
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, undefined if not found
   */
  getBridge(chain: ChainName | ChainId) {
    return undefined;
  }

  /**
   * Returns wormhole bridge contract for the chain
   *
   * @returns An interface for the bridge contract, errors if not found
   */
  mustGetBridge(chain: ChainName | ChainId) {
    throw new Error('not implemented');
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, undefined if not found
   */
  getNftBridge(chain: ChainName | ChainId) {
    return undefined;
  }

  /**
   * Returns wormhole NFT bridge contract for the chain
   *
   * @returns An interface for the NFT bridge contract, errors if not found
   */
  mustGetNftBridge(chain: ChainName | ChainId) {
    throw new Error('not implemented');
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, undefined if not found
   */
  getTokenBridgeRelayer(chain: ChainName | ChainId): any {
    const { relayer: suiRelayerObjectId, suiRelayerPackageId } =
      this.mustGetContracts(chain);
    if (!suiRelayerObjectId || !suiRelayerPackageId) return undefined;
    return new SuiRelayer(
      this.provider,
      suiRelayerObjectId,
      suiRelayerPackageId,
    );
  }

  /**
   * Returns wormhole Token Bridge Relayer contract for the chain
   *
   * @returns An interface for the Token Bridge Relayer contract, errors if not found
   */
  mustGetTokenBridgeRelayer(chain: ChainName | ChainId): any {
    const relayer = this.getTokenBridgeRelayer(chain);
    if (!relayer)
      throw new Error(
        `Token Bridge Relayer contract for domain ${chain} not found`,
      );
    return relayer;
  }
}
