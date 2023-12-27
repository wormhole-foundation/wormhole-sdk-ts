import { Network, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { AlgorandChains, TransactionSignerPair } from "./types";

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
