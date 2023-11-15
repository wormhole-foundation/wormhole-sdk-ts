import { Network, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { TransactionBlock } from "@mysten/sui.js";
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
