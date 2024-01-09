import { expect, test } from "@jest/globals";
import {
  chains,
  CONFIG,
} from "@wormhole-foundation/connect-sdk";
import { CosmwasmPlatform } from "../../src/platform";
import { CosmwasmChains } from "../../src";

const network = "Testnet"; // DEFAULT_NETWORK;
const configs = CONFIG[network].chains;

// const COSMWASM_CHAINS = chains.filter(
//   (c) => chainToPlatform(c) === CosmwasmPlatform.platform
// );
const COSMWASM_CHAINS = chains.filter((c) => c === "Cosmoshub") as CosmwasmChains[];

describe("Cosmwasm Platform Tests", () => {
  describe("Get Chain", () => {
    test("No conf", () => {
      const p = new CosmwasmPlatform(network, {});
      expect(p.config).toEqual({});
      expect(() => p.getChain(COSMWASM_CHAINS[0])).toThrow();
    });

    test("With conf", () => {
      const p = new CosmwasmPlatform(network, {
        [COSMWASM_CHAINS[0]]: configs[COSMWASM_CHAINS[0]],
      });
      expect(() => p.getChain(COSMWASM_CHAINS[0])).not.toThrow();
    });
  });

  describe("Get RPC Connection", () => {
    test("No conf", async () => {
      const p = new CosmwasmPlatform(network, {});
      expect(p.config).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(async () => await p.getRpc(COSMWASM_CHAINS[0])).rejects.toThrow();
      expect(async () => p.getChain(COSMWASM_CHAINS[0])).rejects.toThrow();
    });

    test("With conf", async () => {
      const p = new CosmwasmPlatform(network, {
        [COSMWASM_CHAINS[0]]: configs[COSMWASM_CHAINS[0]],
      });
      expect(async () => await p.getRpc(COSMWASM_CHAINS[0])).not.toThrow();
      expect(
        async () => await p.getChain(COSMWASM_CHAINS[0]).getRpc(),
      ).not.toThrow();
    });
  });
});
