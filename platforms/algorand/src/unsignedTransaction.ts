import { Network, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { Transaction } from "algosdk";
import { AlgorandChains } from "./types";

export class AlgorandUnsignedTransaction<N extends Network, C extends AlgorandChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: Transaction,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
