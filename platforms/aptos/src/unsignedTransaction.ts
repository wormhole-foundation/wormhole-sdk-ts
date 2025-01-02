import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
import type { AptosChains } from "./types.js";

export class AptosUnsignedTransaction<N extends Network, C extends AptosChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: InputGenerateTransactionPayloadData,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
