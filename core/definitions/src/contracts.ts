import { ChainName, Network, contracts } from "@wormhole-foundation/sdk-base";

export type Contracts = {
  coreBridge?: string;
  tokenBridge?: string;
  nftBridge?: string;
  relayer?: string;
  cctp?: contracts.CircleContracts;
};

export function getContracts(n: Network, c: ChainName): Contracts {
  const ct: Contracts = {
    coreBridge: contracts.coreBridge.get(n, c),
    tokenBridge: contracts.tokenBridge.get(n, c),
    nftBridge: contracts.nftBridge.get(n, c),
    relayer: contracts.relayer.get(n, c),
  };

  if (contracts.circleContracts.has(n, c)) {
    ct.cctp = contracts.circleContracts.get(n, c);
  }

  return ct;
}
