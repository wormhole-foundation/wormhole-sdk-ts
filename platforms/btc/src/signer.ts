import type { Network, SignAndSendSigner } from "@wormhole-foundation/sdk-connect";
import type { BtcChains } from "./types.js";

export async function getBtcSigner(
  _rpc: any,
  _privateKey: string,
): Promise<SignAndSendSigner<Network, BtcChains>> {
  throw new Error(
    "getBtcSigner is not implemented — Bitcoin signing is handled externally via wallet adapters",
  );
}
