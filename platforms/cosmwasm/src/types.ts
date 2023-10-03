import {
  UniversalAddress,
  UniversalOrNative,
  PlatformToChains,
  ChainId,
  GatewayTransferMsg,
} from "@wormhole-foundation/connect-sdk";

import { logs as cosmosLogs } from "@cosmjs/stargate";

// GatewayIBCTransferMsg is the message sent in the memo of an IBC transfer
// to be decoded and executed by the Gateway contract.
export interface GatewayIbcTransferMsg {
  gateway_ibc_token_bridge_payload: GatewayTransferMsg;
}

export interface IBCTransferInfo {
  sequence: string;
  timeout: string;
  srcChannel: string;
  dstChannel: string;
  data: string;
}

export interface IBCTransferData {
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
}

export interface WrappedRegistryResponse {
  address: string;
}

export type CosmwasmChainName = PlatformToChains<"Cosmwasm">;
export type UniversalOrCosmwasm = UniversalOrNative<"Cosmwasm"> | string;

export const toCosmwasmAddrString = (addr: UniversalOrCosmwasm) =>
  typeof addr === "string"
    ? addr
    : (addr instanceof UniversalAddress
        ? addr.toNative("Cosmwasm")
        : addr
      ).unwrap();

// TODO: do >1 key at a time
export const searchCosmosLogs = (
  key: string,
  logs: readonly cosmosLogs.Log[]
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
