import { ContractsAbstract } from "../src/abstracts/contracts";
import { ChainName, ChainId, Context } from "../src/types";
import { Wormhole } from "../src/wormhole";
import { filterByContext } from "../src/utils";

export class MockContracts extends ContractsAbstract {
  protected _contracts: Map<ChainName, any>;
  readonly wormhole: Wormhole;

  constructor(wormholeBase: Wormhole) {
    super();
    this.wormhole = wormholeBase;
    this._contracts = new Map();
    const chains = filterByContext(wormholeBase.conf, Context.SEI);
    chains.forEach((c) => {
      this._contracts.set(c.key, c.contracts);
    });
  }

  getContracts(chain: ChainName | ChainId): any | undefined {
    const chainName = this.wormhole.toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName | ChainId): any {
    const chainName = this.wormhole.toChainName(chain);
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
