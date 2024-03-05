import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import { SuiChains } from "./types";

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
