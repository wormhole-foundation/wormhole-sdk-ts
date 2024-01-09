import { Chain, Network, contracts } from "@wormhole-foundation/sdk-base";

export type Contracts = {
  coreBridge?: string;
  tokenBridge?: string;
  tokenBridgeRelayer?: string;
  nftBridge?: string;
  relayer?: string;
  cctp?: contracts.CircleContracts;
  gateway?: string;
  translator?: string;
};

export function getContracts(n: Network, c: Chain): Contracts {
  const ct: Contracts = {
    coreBridge: contracts.coreBridge.get(n, c),
    tokenBridge: contracts.tokenBridge.get(n, c),
    nftBridge: contracts.nftBridge.get(n, c),
    relayer: contracts.relayer.get(n, c),
    tokenBridgeRelayer: contracts.tokenBridgeRelayer.get(n, c),
  };

  if (contracts.circleContracts.has(n, c)) {
    ct.cctp = contracts.circleContracts.get(n, c);
  }

  if (contracts.gateway.has(n, c)) {
    ct.gateway = contracts.gateway.get(n, c);
  }

  if (contracts.translator.has(n, c)) {
    ct.translator = contracts.translator.get(n, c);
  }

  return ct;
}
