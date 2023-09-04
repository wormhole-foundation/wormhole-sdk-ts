import { ChainName, ChainId, toChainName } from "@wormhole-foundation/sdk-base";
import { ChainsConfig, Contracts } from "../..";

export class MockContracts {
  protected _contracts: Map<ChainName, Contracts>;

  constructor(conf: ChainsConfig) {
    this._contracts = new Map();
    Object.entries(conf).forEach(([c, cfg]) => {
      this._contracts.set(c as ChainName, cfg.contracts);
    });
  }

  getContracts(chain: ChainName | ChainId): any | undefined {
    const chainName = toChainName(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: ChainName | ChainId): any {
    const chainName = toChainName(chain);
    const contracts = this._contracts.get(chainName);
    if (!contracts) throw new Error(`no Sui contracts found for ${chain}`);
    return contracts;
  }

  getCore(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetCore(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  getBridge(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetBridge(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  getNftBridge(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetNftBridge(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  getTokenBridgeRelayer(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetTokenBridgeRelayer(chain: ChainName | ChainId) {
    throw new Error("Method not implemented.");
  }
}
