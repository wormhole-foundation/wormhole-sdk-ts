import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { Types } from "aptos";
import type { AptosChains } from "./types.js";

export class AptosUnsignedTransaction<N extends Network, C extends AptosChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: Types.EntryFunctionPayload,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
