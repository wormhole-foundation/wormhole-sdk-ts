import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { HyperliquidChains } from "./types.js";

export class HyperliquidUnsignedTransaction<N extends Network, C extends HyperliquidChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: unknown,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
