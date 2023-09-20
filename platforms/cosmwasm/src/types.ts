import {
  UniversalAddress,
  UniversalOrNative,
  registerNative,
  PlatformToChains,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmAddress } from "./address";
import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

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

interface WrappedRegistryResponse {
  address: string;
}

const MAINNET_NATIVE_DENOMS: Record<string, string> = {
  osmosis: "uosmo",
  wormchain: "uworm",
  terra2: "uluna",
  cosmoshub: "uatom",
  evmos: "aevmos",
};
const TESTNET_NATIVE_DENOMS: Record<string, string> = {
  ...MAINNET_NATIVE_DENOMS,
  evmos: "atevmos",
};

const PREFIXES: Record<string, string> = {
  osmosis: "osmo",
  wormchain: "wormhole",
  terra2: "terra",
  cosmoshub: "cosmos",
  evmos: "evmos",
};

const MSG_EXECUTE_CONTRACT_TYPE_URL = "/cosmwasm.wasm.v1.MsgExecuteContract";
const buildExecuteMsg = (
  sender: string,
  contract: string,
  msg: Record<string, any>,
  funds?: Coin[]
): EncodeObject => ({
  typeUrl: MSG_EXECUTE_CONTRACT_TYPE_URL,
  value: MsgExecuteContract.fromPartial({
    sender: sender,
    contract: contract,
    msg: Buffer.from(JSON.stringify(msg)),
    funds,
  }),
});

const IBC_PORT = "transfer";
