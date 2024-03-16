import * as publicRpcMock from "./mocks/publicrpc.js"; // Should be first

import { describe, expect, test } from "@jest/globals";
import { Platform, platform } from "@wormhole-foundation/sdk-base";
import { ChainContext, PlatformContext, RpcConnection } from "@wormhole-foundation/sdk-definitions";
import { mocks, utils } from "@wormhole-foundation/sdk-definitions/testing";

import { Wormhole, networkPlatformConfigs } from "./../src/index.js";

const network: "Testnet" = "Testnet";
type TNet = typeof network;
const allPlatformCtrs = platform.platforms.map((p) =>
  mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
) as any;

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

  let c: ChainContext<TNet, "Ethereum">;
  test("returns chain", async () => {
    c = wh.getChain("Ethereum");
    expect(c).toBeTruthy();
  });

  describe("getVaaBytes", () => {
    test("returns vaa bytes", async function () {
      const vaa = await wh.getVaaBytes({
        chain: "Arbitrum",
        emitter: utils.makeUniversalAddress("Arbitrum"),
        sequence: 1n,
      });
      expect(vaa).toBeDefined();
    });
    test("returns undefined when vaa bytes not found", async function () {
      publicRpcMock.givenSignedVaaNotFound();
      const vaa = await wh.getVaaBytes(
        { chain: "Aptos", emitter: utils.makeUniversalAddress("Aptos"), sequence: 1n },
        1,
      );
      expect(vaa).toBeNull();
    });
    test("returns after first try fails", async function () {
      publicRpcMock.givenSignedVaaRequestWorksAfterRetry();
      const vaa = await wh.getVaaBytes({
        chain: "Base",
        emitter: utils.makeUniversalAddress("Base"),
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
  test("Gets RPC", async () => {
    rpc = await p.getRpc("Ethereum");
    expect(rpc).toBeTruthy();
  });
});

describe("Chain Tests", () => {
  let c: ChainContext<"Testnet", "Ethereum">;
  beforeEach(() => {
    const wh = new Wormhole(network, allPlatformCtrs);
    c = wh.getChain("Ethereum");
  });

  let rpc: RpcConnection<Platform>;
  test("Gets RPC", async () => {
    rpc = await c.getRpc();
    expect(rpc).toBeTruthy();
  });
});
