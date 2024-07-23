import { expect, test } from "@jest/globals";

import { DEFAULT_NETWORK, CONFIG, chainToPlatform, chains } from "@wormhole-foundation/sdk-connect";

import { SuiChains, SuiPlatform } from "./../../src/index.js";

import "@wormhole-foundation/sdk-sui-core";
import "@wormhole-foundation/sdk-sui-tokenbridge";
import { SuiClient } from "@mysten/sui.js/client";

const network = DEFAULT_NETWORK;

const SUI_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === SuiPlatform._platform,
) as SuiChains[];
const suiChain = SUI_CHAINS[0]!;
const configs = CONFIG[network].chains;

describe("Sui Platform Tests", () => {
  describe("Get Token Bridge", () => {
    test("Hardcoded Genesis mock", async () => {
      const p = new SuiPlatform(network, {
        [suiChain]: configs[suiChain],
      });

      const client = new SuiClient({ url: configs[suiChain]!.rpc });
      const tb = await p.getProtocol("TokenBridge", client);
      expect(tb).toBeTruthy();
    });
  });

  describe("Get Chain", () => {
    test("No conf", () => {
      const p = new SuiPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(suiChain)).toThrow();
    });

    test("With conf", () => {
      const p = new SuiPlatform(network, {
        [suiChain]: configs[suiChain],
      });
      expect(() => p.getChain(suiChain)).not.toThrow();
    });
  });

  describe("Get RPC Connection", () => {
    test("No conf", () => {
      const p = new SuiPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(suiChain)).toThrow();
      expect(() => p.getChain(suiChain)).toThrow();
    });

    test("With conf", () => {
      const p = new SuiPlatform(network, {
        [suiChain]: configs[suiChain],
      });
      expect(() => p.getRpc(suiChain)).not.toThrow();
      expect(() => p.getChain(suiChain).getRpc()).not.toThrow();
    });
  });
});
