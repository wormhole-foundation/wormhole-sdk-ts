import {
  Network,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-connect";
import { SubmittableTransaction } from "xrpl";
import { XrplChains } from "./types.js";

export class XrplUnsignedTransaction<N extends Network, C extends XrplChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: SubmittableTransaction,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
