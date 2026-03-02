import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { BtcChains } from "./types.js";

export interface BtcTransaction {
  /** PSBT encoded as base64 or hex (used for segwit/taproot inputs) */
  psbt?: string;
  /** Raw transaction hex (for simple P2PKH sends) */ 
  hex?: string;
}

export class BtcUnsignedTransaction<N extends Network, C extends BtcChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: BtcTransaction,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
