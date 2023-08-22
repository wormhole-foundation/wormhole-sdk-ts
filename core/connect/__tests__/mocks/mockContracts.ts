import { ChainName, ChainId } from '@wormhole-foundation/sdk-base';
import { Wormhole } from '../../src/wormhole';
import { contracts, platformToChains } from '@wormhole-foundation/sdk-base';

export class MockContracts {
  protected _contracts: Map<ChainName, any>;
  readonly wormhole: Wormhole;

  constructor(wormholeBase: Wormhole) {
    this.wormhole = wormholeBase;
    this._contracts = new Map();
    const chains = platformToChains('Cosmwasm');
    chains.forEach((c) => {
      this._contracts.set(c, contracts['Testnet'][c]);
    });
  }

  getContracts(chain: ChainName | ChainId): any | undefined {
    const chainName = Wormhole.toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName | ChainId): any {
    const chainName = Wormhole.toChainName(chain);
    const contracts = this._contracts.get(chainName);
    if (!contracts) throw new Error(`no Sui contracts found for ${chain}`);
    return contracts;
  }

  getCore(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  mustGetCore(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  getBridge(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  mustGetBridge(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  getNftBridge(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  mustGetNftBridge(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  getTokenBridgeRelayer(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }

  mustGetTokenBridgeRelayer(chain: ChainName | ChainId) {
    throw new Error('Method not implemented.');
  }
}
