import { describe, expect, test } from "@jest/globals";
import { CONFIG, toNative } from "@wormhole-foundation/sdk-connect";
import type { TokenBridge } from "@wormhole-foundation/sdk-connect";
import { SuiChains, SuiPlatform } from "./../../src/index.js";
import { SUI_COIN } from "../../src/constants.js";
import { getTokenCoinType } from "@wormhole-foundation/sdk-sui-tokenbridge";

import "@wormhole-foundation/sdk-sui-core";
import "@wormhole-foundation/sdk-sui-tokenbridge";

/**
 * SuiTokenBridge methods beyond the wrapped-asset read path: getTokenCoinType
 * (CoinTypeKey dynamic field), isTransferCompleted (consumed-VAAs table dynamic field),
 * and createAttestation (PTB construction).
 *
 * Live Sui mainnet RPC. Expected values observed from mainnet.
 */

const network: "Mainnet" = "Mainnet";
type TNet = typeof network;
const configs = CONFIG[network].chains;

const TOKEN_BRIDGE_STATE = "0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9";
// AVAX origin (chain 6) → Sui-wrapped AVAX coin type (no 0x prefix, per trimSuiType)
const AVAX_ADDR = Uint8Array.from(
  Buffer.from("000000000000000000000000b31f66aa3c1e785363f0875a1b74e27b85fd66c7", "hex"),
);
const WAVAX_COIN_TYPE =
  "1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN";

describe("SuiTokenBridge methods", () => {
  const p = new SuiPlatform(network, configs);
  const rpc = p.getRpc("Sui");

  let tb: TokenBridge<TNet, SuiChains>;
  beforeAll(async () => {
    tb = await p.getProtocol("TokenBridge", rpc);
  });

  test("getTokenCoinType(AVAX origin) → wrapped AVAX coin type", async () => {
    const coinType = await getTokenCoinType(rpc, TOKEN_BRIDGE_STATE, AVAX_ADDR, 6);
    expect(coinType).toEqual(WAVAX_COIN_TYPE);
  });

  test("getTokenCoinType(unknown token) → null", async () => {
    const unknown = new Uint8Array(32).fill(7);
    const coinType = await getTokenCoinType(rpc, TOKEN_BRIDGE_STATE, unknown, 6);
    expect(coinType).toBeNull();
  });

  test("isTransferCompleted(unconsumed VAA) → false", async () => {
    // Only vaa.hash is read; an unconsumed hash exercises the consumed-VAAs table
    // dynamic-field lookup and must resolve to `false` (dynamicFieldNotFound).
    const vaa = { hash: new Uint8Array(32).fill(9) } as unknown as TokenBridge.VAA<"Transfer">;
    const completed = await tb.isTransferCompleted(vaa);
    expect(completed).toBe(false);
  });

  test("createAttestation(native SUI) yields one unsigned tx", async () => {
    const txs = [];
    for await (const tx of tb.createAttestation(toNative("Sui", SUI_COIN))) txs.push(tx);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.chain).toEqual("Sui");
    expect(txs[0]!.description).toContain("CreateAttestation");
  });
});
