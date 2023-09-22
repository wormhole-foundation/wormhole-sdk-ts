import { expect, test } from "@jest/globals";
import {
  ChainName,
  chainToPlatform,
  chains,
  chainConfigs,
  testing,
  SupportsTokenBridge,
  DEFAULT_NETWORK,
} from "@wormhole-foundation/connect-sdk";
import { CosmwasmPlatform } from "../../src/platform";

const network = DEFAULT_NETWORK;
const COSMWASM_CHAINS = chains.filter((c) => c === "Cosmoshub");
const configs = chainConfigs("Testnet");

describe("Cosmwasm Platform Tests", () => {
  // describe("Parse Address", () => {
  //   const p = CosmwasmPlatform.setConfig({});
  //   test.each(COSMWASM_CHAINS)("Parses Address for %s", (chain: ChainName) => {
  //     const address = testing.utils.makeNativeAddressHexString(chain);
  //     const parsed = p.parseAddress(chain, address);
  //     expect(parsed).toBeTruthy();
  //     expect(parsed.toNative().toString().toLowerCase()).toEqual(
  //       "0x" + address
  //     );
  //   });
  // });

  describe("Get Token Bridge", () => {
    test("No RPC", async () => {
      const p = CosmwasmPlatform;
      // TODO: wrong
      const rpc = await p.getRpc("Cosmoshub");
      expect(() => p.getTokenBridge(rpc)).rejects.toThrow();
    });
    test("With RPC", async () => {
      const p = CosmwasmPlatform.setConfig(network, {
        [COSMWASM_CHAINS[0]]: configs[COSMWASM_CHAINS[0]],
      });
      const rpc = await p.getRpc("Cosmoshub");

      //const tbp = p as SupportsTokenBridge;
      //const tb = await p.getTokenBridge(rpc);
      //expect(tb).toBeTruthy();
    });
  });

  describe("Get Automatic Token Bridge", () => {
    test("No RPC", async () => {
      const p = CosmwasmPlatform.setConfig(network, {});
      //const rpc = getDefaultProvider("");
      //expect(() => p.getAutomaticTokenBridge(rpc)).rejects.toThrow();
    });
    test("With RPC", async () => {
      const p = CosmwasmPlatform.setConfig(network, {
        [COSMWASM_CHAINS[0]]: configs[COSMWASM_CHAINS[0]],
      });

      //const rpc = getDefaultProvider("");
      //const tb = await p.getAutomaticTokenBridge(rpc);
      //expect(tb).toBeTruthy();
    });
  });

  describe("Get Chain", () => {
    test("No conf", () => {
      // no issues just grabbing the chain
      const p = CosmwasmPlatform.setConfig(network, {});
      expect(p.conf).toEqual({});
      const c = p.getChain(COSMWASM_CHAINS[0]);
      expect(c).toBeTruthy();
    });

    test("With conf", () => {
      const p = CosmwasmPlatform.setConfig(network, {
        [COSMWASM_CHAINS[0]]: configs[COSMWASM_CHAINS[0]],
      });
      expect(() => p.getChain(COSMWASM_CHAINS[0])).not.toThrow();
    });
  });

  describe("Get RPC Connection", () => {
    test("No conf", async () => {
      const p = CosmwasmPlatform.setConfig(network, {});
      expect(p.conf).toEqual({});

      // expect getRpc to throw an error since we havent provided
      // the conf to figure out how to connect
      expect(async () => await p.getRpc(COSMWASM_CHAINS[0])).rejects.toThrow();
      expect(
        async () => await p.getChain(COSMWASM_CHAINS[0]).getRpc()
      ).rejects.toThrow();
    });

    test("With conf", async () => {
      const p = CosmwasmPlatform.setConfig(network, {
        [COSMWASM_CHAINS[0]]: configs[COSMWASM_CHAINS[0]],
      });
      expect(() => p.getRpc(COSMWASM_CHAINS[0])).not.toThrow();
      expect(() => p.getChain(COSMWASM_CHAINS[0]).getRpc()).not.toThrow();
    });
  });
});
