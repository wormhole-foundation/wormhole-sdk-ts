import * as publicRpcMock from "./mocks/publicrpc"; // Should be first

import { describe, expect, test } from "@jest/globals";
import { Platform, platform } from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  PlatformContext,
  RpcConnection,
  testing,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole, networkPlatformConfigs } from "../src";

const network: "Testnet" = "Testnet";
type TNet = typeof network;
const allPlatformCtrs = platform.platforms.map((p) =>
  testing.mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
);

describe("Wormhole Tests", () => {
  let wh: Wormhole<TNet>;
  beforeEach(() => {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  let p: PlatformContext<TNet, any>;
  test("returns Platform", async () => {
    p = wh.getPlatform("Evm");
    expect(p).toBeTruthy();
  });

  let c: ChainContext<TNet, "Evm", "Ethereum">;
  test("returns chain", async () => {
    c = wh.getChain("Ethereum");
    expect(c).toBeTruthy();
  });

  describe("getVaaBytes", () => {
    test("returns vaa bytes", async function () {
      const vaa = await wh.getVaaBytes({
        chain: "Arbitrum",
        emitter: testing.utils.makeUniversalAddress("Arbitrum"),
        sequence: 1n,
      });
      expect(vaa).toBeDefined();
    });

    test("returns undefined when vaa bytes not found", async function () {
      publicRpcMock.givenSignedVaaNotFound();
      const vaa = await wh.getVaaBytes(
        { chain: "Aptos", emitter: testing.utils.makeUniversalAddress("Aptos"), sequence: 1n },
        1,
      );
      expect(vaa).toBeNull();
    });

    test("returns after first try fails", async function () {
      publicRpcMock.givenSignedVaaRequestWorksAfterRetry();
      const vaa = await wh.getVaaBytes({
        chain: "Base",
        emitter: testing.utils.makeUniversalAddress("Base"),
        sequence: 1n,
      });
      expect(vaa).toBeDefined();
    });
  });
});

describe("Platform Tests", () => {
  let p: PlatformContext<"Testnet", "Evm">;
  beforeEach(() => {
    const wh = new Wormhole(network, allPlatformCtrs);
    p = wh.getPlatform("Evm");
  });

  let rpc: RpcConnection<Platform>;
  test("Gets RPC", () => {
    rpc = p.getRpc("Ethereum");
    expect(rpc).toBeTruthy();
  });
});

describe("Chain Tests", () => {
  let c: ChainContext<"Testnet", "Evm", "Ethereum">;
  beforeEach(() => {
    const wh = new Wormhole(network, allPlatformCtrs);
    c = wh.getChain("Ethereum");
  });

  let rpc: RpcConnection<Platform>;
  test("Gets RPC", () => {
    rpc = c.getRpc();
    expect(rpc).toBeTruthy();
  });
});
