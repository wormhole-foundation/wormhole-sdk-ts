import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { StdFee, calculateFee } from "@cosmjs/stargate";
import { Network, UnsignedTransaction, amount, encoding } from "@wormhole-foundation/connect-sdk";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { DEFAULT_FEE, MSG_EXECUTE_CONTRACT_TYPE_URL, averageGasPrices } from "./constants";
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
  const avgFee = averageGasPrices.get(network, chain);
  if (!avgFee) throw new Error(`No average gas fee configured for ${network} ${chain}`);

  const avgFeeNormalized = avgFee.includes(".")
    ? Number(avgFee)
    : Number(amount.display(amount.fromBaseUnits(BigInt(avgFee), 18), 10)).toFixed(10);

  console.log(avgFee);
  console.log(avgFeeNormalized);

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
