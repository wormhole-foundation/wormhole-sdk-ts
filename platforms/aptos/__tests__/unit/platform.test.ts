import { expect, test } from "@jest/globals";

import { DEFAULT_NETWORK, CONFIG, chainToPlatform, chains } from "@wormhole-foundation/sdk-connect";

import { AptosChains, AptosPlatform } from "./../../src/index.js";

import "@wormhole-foundation/sdk-aptos-core";
import "@wormhole-foundation/sdk-aptos-tokenbridge";
import { Aptos, AptosConfig, Network as AptosNetwork } from "@aptos-labs/ts-sdk";

const network = DEFAULT_NETWORK;

const APTOS_CHAINS = chains.filter(
  (c) => chainToPlatform(c) === AptosPlatform._platform,
) as AptosChains[];
const configs = CONFIG[network].chains;

describe("Aptos Platform Tests", () => {
  describe("Get Token Bridge", () => {
    test("Hardcoded Genesis mock", async () => {
      const p = new AptosPlatform(network, {
        [APTOS_CHAINS[0]!]: configs[APTOS_CHAINS[0]!],
      });

      const config = new AptosConfig({
        fullnode: configs[APTOS_CHAINS[0]!]!.rpc,
        network: AptosNetwork.MAINNET,
      });
      const client = new Aptos(config);
      const tb = await p.getProtocol("TokenBridge", client);
      expect(tb).toBeTruthy();
    });
  });

  describe("Get Chain", () => {
    test("No conf", () => {
      const p = new AptosPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(APTOS_CHAINS[0]!)).toThrow();
    });

    test("With conf", () => {
      const p = new AptosPlatform(network, {
        [APTOS_CHAINS[0]!]: configs[APTOS_CHAINS[0]!],
      });
      expect(() => p.getChain(APTOS_CHAINS[0]!)).not.toThrow();
    });
  });

  describe("Get RPC Connection", () => {
    test("No conf", () => {
      const p = new AptosPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(() => p.getRpc(APTOS_CHAINS[0]!)).toThrow();
      expect(() => p.getChain(APTOS_CHAINS[0]!)).toThrow();
    });

    test("With conf", () => {
      const p = new AptosPlatform(network, {
        [APTOS_CHAINS[0]!]: configs[APTOS_CHAINS[0]!],
      });
      expect(() => p.getRpc(APTOS_CHAINS[0]!)).not.toThrow();
      expect(() => p.getChain(APTOS_CHAINS[0]!).getRpc()).not.toThrow();
    });
  });
});
