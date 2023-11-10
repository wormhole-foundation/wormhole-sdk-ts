import { Chain, ChainId, toChain } from "@wormhole-foundation/sdk-base";
import { ChainsConfig, Contracts } from "../..";

export class MockContracts {
  protected _contracts: Map<Chain, Contracts>;

  constructor(conf: ChainsConfig) {
    this._contracts = new Map();
    Object.entries(conf).forEach(([c, cfg]) => {
      this._contracts.set(c as Chain, cfg.contracts);
    });
  }

  getContracts(chain: Chain | ChainId): any | undefined {
    const chainName = toChain(chain);
    return this._contracts.get(chainName);
  }

  mustGetContracts(chain: Chain | ChainId): any {
    const chainName = toChain(chain);
    const contracts = this._contracts.get(chainName);
    if (!contracts) throw new Error(`no Sui contracts found for ${chain}`);
    return contracts;
  }

  getCore(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetCore(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  getBridge(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetBridge(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  getNftBridge(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetNftBridge(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  getTokenBridgeRelayer(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }

  mustGetTokenBridgeRelayer(chain: Chain | ChainId) {
    throw new Error("Method not implemented.");
  }
}
