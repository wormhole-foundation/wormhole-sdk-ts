import { expect, test } from "@jest/globals";

import { DEFAULT_NETWORK, CONFIG, chainToPlatform, chains } from "@wormhole-foundation/connect-sdk";

import { SuiChains, SuiPlatform } from './../../src/index.js';

import "@wormhole-foundation/connect-sdk-sui-core";
import "@wormhole-foundation/connect-sdk-sui-tokenbridge";
import { SuiClient } from "@mysten/sui.js/client";

const network = DEFAULT_NETWORK;

const SUI_CHAINS = chains.filter((c) => chainToPlatform(c) === SuiPlatform._platform) as string[];
const configs = CONFIG[network].chains;

describe("Sui Platform Tests", () => {
  describe("Get Token Bridge", () => {
    test("Hardcoded Genesis mock", async () => {
      const p = new SuiPlatform(network, {
        [SUI_CHAINS[0]]: configs[SUI_CHAINS[0]],
      });

      const client = new SuiClient({ url: configs[SUI_CHAINS[0]].rpc });
      const tb = await p.getProtocol("TokenBridge", client);
      expect(tb).toBeTruthy();
    });
  });

  describe("Get Chain", () => {
    test("No conf", () => {
      const p = new SuiPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(SUI_CHAINS[0])).toThrow();
    });

    test("With conf", () => {
      const p = new SuiPlatform(network, {
        [SUI_CHAINS[0]]: configs[SUI_CHAINS[0]],
      });
      expect(() => p.getChain(SUI_CHAINS[0])).not.toThrow();
    });
  });

  describe("Get RPC Connection", () => {
    test("No conf", () => {
      const p = new SuiPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(SUI_CHAINS[0])).toThrow();
      expect(() => p.getChain(SUI_CHAINS[0])).toThrow();
    });

    test("With conf", () => {
      const p = new SuiPlatform(network, {
        [SUI_CHAINS[0]]: configs[SUI_CHAINS[0]],
      });
      expect(() => p.getRpc(SUI_CHAINS[0])).not.toThrow();
      expect(() => p.getChain(SUI_CHAINS[0]).getRpc()).not.toThrow();
    });
  });
});
