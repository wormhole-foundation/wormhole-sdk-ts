import { ChainName, Network, contracts } from "@wormhole-foundation/sdk-base";

export type Contracts = {
  coreBridge?: string;
  tokenBridge?: string;
  nftBridge?: string;
  relayer?: string;
  cctp: {
    tokenMessenger?: string;
    messageTransmitter?: string;
    wormholeRelayer?: string;
    wormhole?: string;
  };
};

export function getContracts(n: Network, c: ChainName): Contracts {
  return {
    coreBridge: contracts.coreBridge.get(n, c),
    tokenBridge: contracts.tokenBridge.get(n, c),
    nftBridge: contracts.nftBridge.get(n, c),
    relayer: contracts.relayer.get(n, c),
    cctp: {
      tokenMessenger: contracts.cctpTokenMessenger.get(n, c),
      messageTransmitter: contracts.cctpMessageTransmitter.get(n, c),
      wormholeRelayer: contracts.cctpWormholeRelayer.get(n, c),
      wormhole: contracts.cctpWormhole.get(n, c),
    },
  };
}
