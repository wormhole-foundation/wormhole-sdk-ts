import type { Coin, EncodeObject } from "@cosmjs/proto-signing";
import type { StdFee } from "@cosmjs/stargate";
import { calculateFee } from "@cosmjs/stargate";
import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import { encoding } from "@wormhole-foundation/sdk-connect";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx.js";
import { DEFAULT_FEE, MSG_EXECUTE_CONTRACT_TYPE_URL, averageGasPrices } from "./constants.js";
import { CosmwasmPlatform } from "./platform.js";
import type { CosmwasmChains } from "./types.js";

export interface CosmwasmTransaction {
  fee: StdFee;
  msgs: EncodeObject[];
  memo: string;
}

export function computeFee<N extends Network, C extends CosmwasmChains>(
  network: N,
  chain: C,
): StdFee {
  let avgFee: string = averageGasPrices.get(network, chain) as string;
  if (!avgFee) avgFee = "0.1";

  return calculateFee(
    DEFAULT_FEE * 1.5,
    `${avgFee}${CosmwasmPlatform.getNativeDenom(network, chain)}`,
  );
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
