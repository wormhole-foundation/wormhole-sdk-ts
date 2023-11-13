import { expect, test } from "@jest/globals";

import { DEFAULT_NETWORK, CONFIG, chainToPlatform, chains } from "@wormhole-foundation/connect-sdk";

import { AptosChains, AptosPlatform } from "../../src";

import "@wormhole-foundation/connect-sdk-aptos-core";
import "@wormhole-foundation/connect-sdk-aptos-tokenbridge";
import { AptosClient } from "aptos";

const network = DEFAULT_NETWORK;

const APTOS_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === AptosPlatform._platform,
) as AptosChains[];
const configs = CONFIG[network].chains;

describe("Aptos Platform Tests", () => {
  describe("Get Token Bridge", () => {
    test("Hardcoded Genesis mock", async () => {
      const p = new AptosPlatform(network, {
        [APTOS_CHAINS[0]]: configs[APTOS_CHAINS[0]],
      });

      const client = new AptosClient(configs[APTOS_CHAINS[0]].rpc);
      const tb = await p.getProtocol("TokenBridge", client);
      expect(tb).toBeTruthy();
    });
  });

  describe("Get Chain", () => {
    test("No conf", () => {
      const p = new AptosPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(APTOS_CHAINS[0])).toThrow();
    });

    test("With conf", () => {
      const p = new AptosPlatform(network, {
        [APTOS_CHAINS[0]]: configs[APTOS_CHAINS[0]],
      });
      expect(() => p.getChain(APTOS_CHAINS[0])).not.toThrow();
    });
  });

  describe("Get RPC Connection", () => {
    test("No conf", () => {
      const p = new AptosPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(APTOS_CHAINS[0])).toThrow();
      expect(() => p.getChain(APTOS_CHAINS[0])).toThrow();
    });

    test("With conf", () => {
      const p = new AptosPlatform(network, {
        [APTOS_CHAINS[0]]: configs[APTOS_CHAINS[0]],
      });
      expect(() => p.getRpc(APTOS_CHAINS[0])).not.toThrow();
      expect(() => p.getChain(APTOS_CHAINS[0]).getRpc()).not.toThrow();
    });
  });
});
