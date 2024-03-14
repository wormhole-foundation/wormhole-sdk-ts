import type { TransactionBlock } from "@mysten/sui.js/transactions";
import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { SuiChains } from "./types.js";

export class SuiUnsignedTransaction<N extends Network, C extends SuiChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: TransactionBlock,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
