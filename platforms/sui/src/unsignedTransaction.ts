import type { Transaction } from "@mysten/sui/transactions";
import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { SuiChains } from "./types.js";

export class SuiUnsignedTransaction<N extends Network, C extends SuiChains>
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
