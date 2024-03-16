import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { AlgorandChains, TransactionSignerPair } from "./types.js";

export class AlgorandUnsignedTransaction<N extends Network, C extends AlgorandChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: TransactionSignerPair,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
