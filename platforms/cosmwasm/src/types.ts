import {
  UniversalAddress,
  UniversalOrNative,
  registerNative,
  PlatformToChains,
  ChainId,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmAddress } from "./address";
import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { MSG_EXECUTE_CONTRACT_TYPE_URL } from "./constants";

registerNative("Cosmwasm", CosmwasmAddress);

export interface GatewayTransferMsg {
  gateway_transfer: {
    chain: ChainId;
    recipient: string;
    fee: string;
    nonce: number;
  };
}

export interface FromCosmosPayload {
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

export const buildExecuteMsg = (
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
