import type {
  Network,
  SignAndSendSigner,
  Signer,
  TxHash,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-connect";
import type { HyperliquidChains } from "./types.js";

export async function getHyperliquidSigner(): Promise<Signer> {
  return new HyperliquidSigner("HyperCore");
}

// HyperliquidSigner implements SignOnlySender
export class HyperliquidSigner<N extends Network, C extends HyperliquidChains> implements SignAndSendSigner<N, C> {
  constructor(
    private _chain: C,
  ) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    throw new Error("Method not implemented for hyperliquid");
  }

  async signAndSend(txns: UnsignedTransaction[]): Promise<TxHash[]> {
    throw new Error("Method not implemented for hyperliquid");
  }
}
