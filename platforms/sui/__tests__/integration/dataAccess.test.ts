import { describe, expect, test } from "@jest/globals";
import { CONFIG, toNative } from "@wormhole-foundation/sdk-connect";
import type { TokenBridge } from "@wormhole-foundation/sdk-connect";
import { SuiChains, SuiPlatform } from "./../../src/index.js";
import { SUI_COIN } from "../../src/constants.js";

import "@wormhole-foundation/sdk-sui-core";
import "@wormhole-foundation/sdk-sui-tokenbridge";

/**
 * Sui data-access reads: SuiPlatform.chainFromRpc / getDecimals / getLatestBlock and
 * the token-bridge wrapped-asset read path (isWrappedAsset / getOriginalAsset /
 * getWrappedAsset / hasWrappedAsset).
 *
 * Runs against live Sui mainnet RPC (no mocks). Expected values observed from mainnet.
 */

const network: "Mainnet" = "Mainnet";
type TNet = typeof network;
const configs = CONFIG[network].chains;

// wsui = native SUI coin type; wavax = Sui-wrapped Avalanche AVAX (origin chain Avalanche)
const WSUI = SUI_COIN;
const WAVAX = "0x1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN";

// Avalanche AVAX universal address (origin of WAVAX), observed via getOriginalAsset
const AVAX_ORIGIN_ADDR = "0x000000000000000000000000b31f66aa3c1e785363f0875a1b74e27b85fd66c7";

describe("Sui data-access reads", () => {
  const p = new SuiPlatform(network, configs);
  const rpc = p.getRpc("Sui");

  let tb: TokenBridge<TNet, SuiChains>;
  beforeAll(async () => {
    tb = await p.getProtocol("TokenBridge", rpc);
  });

  describe("platform", () => {
    test("chainFromRpc → [Mainnet, Sui]", async () => {
      const [net, chain] = await SuiPlatform.chainFromRpc(rpc);
      expect(net).toEqual("Mainnet");
      expect(chain).toEqual("Sui");
    });

    test("getDecimals native (SUI) → 9", async () => {
      const d = await SuiPlatform.getDecimals("Mainnet", "Sui", rpc, "native");
      expect(d).toEqual(9);
    });

    test("getDecimals wrapped (WAVAX) → 8", async () => {
      const d = await SuiPlatform.getDecimals("Mainnet", "Sui", rpc, WAVAX);
      expect(d).toEqual(8);
    });

    test("getLatestBlock is a positive integer above a known floor", async () => {
      const b = await SuiPlatform.getLatestBlock(rpc);
      expect(Number.isInteger(b)).toBe(true);
      // mainnet checkpoint height was ~284.6M in 2026-06; only grows
      expect(b).toBeGreaterThan(284_000_000);
    });
  });

  describe("tokenBridge wrapped-asset read path", () => {
    test("isWrappedAsset: WAVAX=true, WSUI=false", async () => {
      expect(await tb.isWrappedAsset(toNative("Sui", WAVAX))).toBe(true);
      expect(await tb.isWrappedAsset(toNative("Sui", WSUI))).toBe(false);
    });

    test("getOriginalAsset(WAVAX) → Avalanche / AVAX origin address", async () => {
      const orig = await tb.getOriginalAsset(toNative("Sui", WAVAX));
      expect(orig.chain).toEqual("Avalanche");
      expect(orig.address.toString()).toEqual(AVAX_ORIGIN_ADDR);
    });

    test("getWrappedAsset(origin) round-trips to WAVAX coin type", async () => {
      const orig = await tb.getOriginalAsset(toNative("Sui", WAVAX));
      const wrapped = await tb.getWrappedAsset(orig);
      expect(wrapped.toString()).toEqual(WAVAX);
    });

    test("hasWrappedAsset(origin) → true", async () => {
      const orig = await tb.getOriginalAsset(toNative("Sui", WAVAX));
      expect(await tb.hasWrappedAsset(orig)).toBe(true);
    });
  });
});
