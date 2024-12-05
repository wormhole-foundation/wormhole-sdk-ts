import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { contracts } from "@wormhole-foundation/sdk-base";

// Allow contracts to be passed that aren't
// part of the known contract set
type UnknownContracts = Record<string, any>;

/** The Contract addresses set in configuration for a given chain */
export type Contracts = {
  coreBridge?: string;
  tokenBridge?: string;
  tokenBridgeRelayer?: string;
  nftBridge?: string;
  relayer?: string;
  cctp?: contracts.CircleContracts;
  gateway?: string;
  translator?: string;
  portico?: contracts.PorticoContracts;
} & UnknownContracts;

/**
 *
 * Get the contracts for a given network and chain
 *
 * @param n the network to get contracts for
 * @param c the chain to get contracts for
 * @returns the contracts for the given network and chain
 */
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

  if (contracts.portico.has(n, c)) {
    ct.portico = contracts.portico.get(n, c);
  }

  return ct;
}
