import { UniversalOrNative, PlatformToChains } from "@wormhole-foundation/connect-sdk";
import { logs as cosmosLogs } from "@cosmjs/stargate";

export const _platform: "Cosmwasm" = "Cosmwasm";
export type CosmwasmPlatformType = typeof _platform;

export type CosmwasmChains = PlatformToChains<CosmwasmPlatformType>;
export type UniversalOrCosmwasm = UniversalOrNative<CosmwasmChains>;
export type AnyCosmwasmAddress = UniversalOrCosmwasm | string | Uint8Array;

export interface WrappedRegistryResponse {
  address: string;
}

export const searchCosmosLogs = (key: string, logs: readonly cosmosLogs.Log[]): string | null => {
  for (const log of logs) {
    for (const ev of log.events) {
      for (const attr of ev.attributes) {
        if (attr.key === key) return attr.value;
      }
    }
  }
  return null;
};
