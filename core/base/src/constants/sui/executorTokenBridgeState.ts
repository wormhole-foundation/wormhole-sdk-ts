import { constMap } from "../../utils/index.js";
import type { MapLevels } from "../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

export type SuiExecutorTokenBridgeState = {
  // Token Bridge Relayer V4 State object ID
  readonly relayerStateId: string;
  // Token Bridge Relayer V4 Package ID
  readonly relayerPackageId: string;
  // PTB Resolver State ID, used as dstExecutionAddress
  readonly ptbResolverStateId: string;
  //Token Bridge Relayer V4 Emitter Cap, used as dstTransferRecipient
  readonly relayerEmitterCap: string;
};

export const _suiExecutorTokenBridgeState = [
  [
    "Testnet",
    {
      relayerStateId: "0xae0d664920a60c42c89f1e7d00aee5006f0af4b4464be37c497853728f211d51",
      relayerPackageId: "0xb4b86c12d4ee0a813d976fb452b7afb325a2b381d00ccb2e54c5342f5ef2e684",
      ptbResolverStateId: "0x9d0a4cc9b2e6df6bfdd5ae86fde43b1d116d662ff600d24e00ef58f1beb4d2be",
      relayerEmitterCap: "0x3f58fae5151559978a9583104a5805593b94fa0e6b384085771a81ec62dad7fa",
    },
  ],
  [
    "Mainnet",
    {
      relayerStateId: "0x7f777663622c2570ca6168d68caa56403efc6b97cb9cb314939b7f7701136e0d",
      relayerPackageId: "0x9b68b36399a3cd87680878d72253b3e8fdf82edb8ed74f7ec440b8bddd51f85d",
      ptbResolverStateId: "0xd65e62e2797c078bb4f9059aa46fe7150253b330899a81965dbd909bf6889dfc",
      relayerEmitterCap: "0xf5dffae04382c0c14379d551696f0751310c7fc35f454cc29263a4c862c82c82",
    },
  ],
] as const satisfies MapLevels<[Network, SuiExecutorTokenBridgeState]>;

export const suiExecutorTokenBridgeState = constMap(_suiExecutorTokenBridgeState, [0, 1]);

/**
 * Get the destination addresses for Executor Token Bridge transfers.
 * For Sui destinations, dstTransferRecipient (relayer emitter cap) and dstExecutionAddress (PTB resolver) are different.
 * For other chains, both addresses are the same (the relayer contract address).
 */
export function getExecutorTokenBridgeDestinationAddresses(
  network: "Mainnet" | "Testnet",
  destinationChain: Chain,
  dstRelayerAddress: string,
): { dstTransferRecipient: string; dstExecutionAddress: string } {
  if (destinationChain === "Sui") {
    const suiState = suiExecutorTokenBridgeState(network);
    return {
      dstTransferRecipient: suiState.relayerEmitterCap,
      dstExecutionAddress: suiState.ptbResolverStateId,
    };
  }
  return {
    dstTransferRecipient: dstRelayerAddress,
    dstExecutionAddress: dstRelayerAddress,
  };
}
