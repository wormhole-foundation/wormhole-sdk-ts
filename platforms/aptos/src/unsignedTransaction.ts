import { ChainName, Network, UnsignedTransaction } from "@wormhole-foundation/connect-sdk";
import { Types } from "aptos";

export class AptosUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: Types.EntryFunctionPayload,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) { }
}
