import {
  UniversalAddress,
  UniversalOrNative,
  PlatformToChains,
  GatewayTransferMsg,
} from "@wormhole-foundation/connect-sdk";
import { logs as cosmosLogs } from "@cosmjs/stargate";

export type CosmwasmChainName = PlatformToChains<"Cosmwasm">;
export type UniversalOrCosmwasm = UniversalOrNative<"Cosmwasm">;
export type AnyCosmwasmAddress = UniversalOrCosmwasm | string;

export interface WrappedRegistryResponse {
  address: string;
}

export const toCosmwasmAddrString = (addr: AnyCosmwasmAddress) =>
  typeof addr === "string"
    ? addr
    : (addr instanceof UniversalAddress
        ? addr.toNative("Cosmwasm")
        : addr
      ).unwrap();

// TODO: do >1 key at a time
export const searchCosmosLogs = (
  key: string,
  logs: readonly cosmosLogs.Log[],
): string | null => {
  for (const log of logs) {
    for (const ev of log.events) {
      for (const attr of ev.attributes) {
        if (attr.key === key) return attr.value;
      }
    }
  }
  return null;
};
