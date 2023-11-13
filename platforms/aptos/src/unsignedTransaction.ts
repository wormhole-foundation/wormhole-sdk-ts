import { Network, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { Types } from "aptos";
import { AptosChains } from "./types";

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
