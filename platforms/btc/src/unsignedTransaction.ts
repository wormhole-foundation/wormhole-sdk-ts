import type { Network, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import type { BtcChains } from "./types.js";

export type BtcTransaction =
  | {
      /** PSBT encoded as base64 or hex (used for segwit/taproot inputs) */
      psbt: string;
      hex?: never;
    }
  | {
      /** Raw transaction hex (for simple P2PKH sends) */
      hex: string;
      psbt?: never;
    };

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
