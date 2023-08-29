import { Connection } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import {
  Wormhole,
  Contracts,
  ChainsConfig,
} from '@wormhole-foundation/connect-sdk';
import { ChainName, toChainName } from '@wormhole-foundation/sdk-base';

import { Wormhole as WormholeCore } from './utils/types/wormhole';
import { createReadOnlyWormholeProgramInterface } from './utils/wormhole';

// import { TokenBridge } from '@certusone/wormhole-sdk/lib/cjs/solana/types/tokenBridge';
// import { NftBridge } from '@certusone/wormhole-sdk/lib/cjs/solana/types/nftBridge';
// import {
//   ChainName,
//   ChainId,
//   Contracts,
//   Context,
//   Network,
//   TokenBridgeRelayer,
//   ContractsAbstract,
//   Wormhole,
//   filterByContext,
// } from '@wormhole-foundation/connect-sdk';

//import { createReadOnlyTokenBridgeProgramInterface } from './utils/tokenBridge';
//import { createReadOnlyNftBridgeProgramInterface } from './utils/nftBridge';

/**
 * @category Solana
 */
export class SolContracts {
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

  // /**
  //  * Returns core wormhole contract for the chain
  //  *
  //  * @returns An interface for the core contract, errors if not found
  //  */
  // mustGetCore(chain?: ChainName | ChainId): Program<WormholeCore> {
  //   const core = this.getCore(chain);
  //   if (!core) throw new Error(`Core contract for domain ${chain} not found`);
  //   return core;
  // }

  // /**
  //  * Returns wormhole bridge contract for the chain
  //  *
  //  * @returns An interface for the bridge contract, undefined if not found
  //  */
  // getBridge(chain?: ChainName | ChainId): Program<TokenBridge> | undefined {
  //   if (!this.connection) throw new Error('no connection');

  //   const contracts = this.wormhole.mustGetContracts('solana');
  //   if (!contracts.token_bridge) return;

  //   return createReadOnlyTokenBridgeProgramInterface(
  //     contracts.token_bridge,
  //     this.connection,
  //   );
  // }

  // /**
  //  * Returns wormhole bridge contract for the chain
  //  *
  //  * @returns An interface for the bridge contract, errors if not found
  //  */
  // mustGetBridge(chain?: ChainName | ChainId): Program<TokenBridge> {
  //   const bridge = this.getBridge(chain);
  //   if (!bridge)
  //     throw new Error(`Bridge contract for domain ${chain} not found`);
  //   return bridge;
  // }

  // /**
  //  * Returns wormhole NFT bridge contract for the chain
  //  *
  //  * @returns An interface for the NFT bridge contract, undefined if not found
  //  */
  // getNftBridge(chain?: ChainName | ChainId): Program<NftBridge> | undefined {
  //   if (!this.connection) throw new Error('no connection');

  //   const contracts = this.wormhole.mustGetContracts('solana');
  //   if (!contracts.nft_bridge) return;

  //   return createReadOnlyNftBridgeProgramInterface(
  //     contracts.nft_bridge,
  //     this.connection,
  //   );
  // }

  // /**
  //  * Returns wormhole NFT bridge contract for the chain
  //  *
  //  * @returns An interface for the NFT bridge contract, errors if not found
  //  */
  // mustGetNftBridge(chain: ChainName | ChainId): Program<NftBridge> {
  //   const nftBridge = this.getNftBridge(chain);
  //   if (!nftBridge)
  //     throw new Error(`NFT Bridge contract for domain ${chain} not found`);
  //   return nftBridge;
  // }

  // /**
  //  * Returns wormhole Token Bridge Relayer contract for the chain
  //  *
  //  * @returns An interface for the Token Bridge Relayer contract, undefined if not found
  //  */
  // getTokenBridgeRelayer(
  //   chain?: ChainName | ChainId,
  // ): TokenBridgeRelayer | undefined {
  //   return undefined;
  // }

  // /**
  //  * Returns wormhole Token Bridge Relayer contract for the chain
  //  *
  //  * @returns An interface for the Token Bridge Relayer contract, errors if not found
  //  */
  // mustGetTokenBridgeRelayer(chain: ChainName | ChainId): TokenBridgeRelayer {
  //   throw new Error('relayer not deployed on Solana');
  // }
}
