import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { StdFee, calculateFee } from "@cosmjs/stargate";
import {
  UnsignedTransaction,
  Chain,
  Network,
  encoding,
} from "@wormhole-foundation/connect-sdk";
import { MSG_EXECUTE_CONTRACT_TYPE_URL, DEFAULT_FEE } from "./constants";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { CosmwasmPlatform } from "./platform";

export interface CosmwasmTransaction {
  fee: StdFee;
  msgs: EncodeObject[];
  memo: string;
}

export function computeFee(chain: Chain): StdFee {
  return calculateFee(DEFAULT_FEE, `0.1${CosmwasmPlatform.getNativeDenom(chain)}`);
}

export function buildExecuteMsg(
  sender: string,
  contract: string,
  msg: Record<string, any>,
  funds?: Coin[],
): EncodeObject {
  return {
    typeUrl: MSG_EXECUTE_CONTRACT_TYPE_URL,
    value: MsgExecuteContract.fromPartial({
      sender: sender,
      contract: contract,
      msg: encoding.toUint8Array(JSON.stringify(msg)),
      funds,
    }),
  };
}

export class CosmwasmUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: CosmwasmTransaction,
    readonly network: Network,
    readonly chain: Chain,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
