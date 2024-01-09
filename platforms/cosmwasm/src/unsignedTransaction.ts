import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { StdFee, calculateFee } from "@cosmjs/stargate";
import { Network, UnsignedTransaction, encoding } from "@wormhole-foundation/connect-sdk";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { DEFAULT_FEE, MSG_EXECUTE_CONTRACT_TYPE_URL } from "./constants";
import { CosmwasmPlatform } from "./platform";
import { CosmwasmChains } from "./types";

export interface CosmwasmTransaction {
  fee: StdFee;
  msgs: EncodeObject[];
  memo: string;
}

export function computeFee<N extends Network, C extends CosmwasmChains>(
  network: N,
  chain: C,
): StdFee {
  return calculateFee(DEFAULT_FEE, `0.1${CosmwasmPlatform.getNativeDenom(network, chain)}`);
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
      msg: encoding.bytes.encode(JSON.stringify(msg)),
      funds,
    }),
  };
}

export class CosmwasmUnsignedTransaction<N extends Network, C extends CosmwasmChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: CosmwasmTransaction,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
