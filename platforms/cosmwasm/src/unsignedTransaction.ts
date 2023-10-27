import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { StdFee, calculateFee } from "@cosmjs/stargate";
import {
  UnsignedTransaction,
  ChainName,
  Network,
  encoding,
} from "@wormhole-foundation/connect-sdk";
import { MSG_EXECUTE_CONTRACT_TYPE_URL } from "./constants";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { CosmwasmPlatform } from "./platform";

export interface CosmwasmTransaction {
  fee: StdFee;
  msgs: EncodeObject[];
  memo: string;
}

export function computeFee(chain: ChainName): StdFee {
  const denom = CosmwasmPlatform.getNativeDenom(chain);
  // TODO: dont hardcode ths stuff
  return calculateFee(1_000_000, `0.1${denom}`);
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
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
