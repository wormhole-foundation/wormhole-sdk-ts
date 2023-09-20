import {
  UniversalAddress,
  UniversalOrNative,
  registerNative,
  PlatformToChains,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmAddress } from "./address";

registerNative("Cosmwasm", CosmwasmAddress);

export type CosmwasmChainName = PlatformToChains<"Cosmwasm">;
export type UniversalOrCosmwasm = UniversalOrNative<"Cosmwasm"> | string;

export const toCosmwasmAddrString = (addr: UniversalOrCosmwasm) =>
  typeof addr === "string"
    ? addr
    : (addr instanceof UniversalAddress
        ? addr.toNative("Cosmwasm")
        : addr
      ).unwrap();
