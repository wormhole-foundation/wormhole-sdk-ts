import { jest, describe, expect, test } from "@jest/globals";

const vaaBytes =
  "AQAAAAABAFF+Nf18NSYNieW1ScgE+mB8aQwT38tJfMhfcP9tpIvINkjrdoXQHDRdFvBoLU0e9ubPDXCJ5cfstpBv7Oa/WecAZSV4BAAAAAAACGJB/9wDK2k7+4VEhY8EA97Iby4XIK+fNPjWX+V0tiOMAAAAAAAAF2EAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJ6zttAAAAAAAAAAAAAAAAu98b+5NUusWMNKhaKUmCvK8+XJwAAgAAAAAAAAAAAAAAAIVCzopf6Qwm6UA2xnYjuVOvQ+dyAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

type response = { status: number; data: any };

const successfulResponse: response = { status: 200, data: { vaaBytes } };
const notFoundResponse: response = {
  status: 404,
  data: { code: 5, message: "requested VAA not found in store", details: [] as any[] },
};

let nextGet: jest.Mock = jest.fn<any>().mockResolvedValue(successfulResponse);
jest.mock("axios", () => {
  return { ...(jest.requireActual("axios") as any), get: () => nextGet() };
});

const publicRpcMock = {
  givenSignedVaaNotFound: () => {
    nextGet = jest.fn<any>().mockRejectedValue(notFoundResponse);
  },
  givenSignedVaaRequestWorksAfterRetry: () => {
    nextGet = jest
      .fn<any>()
      .mockRejectedValueOnce(notFoundResponse)
      .mockResolvedValueOnce(successfulResponse);
  },
};

import { Platform, platform } from "@wormhole-foundation/sdk-base";
import { ChainContext, PlatformContext, RpcConnection } from "@wormhole-foundation/sdk-definitions";
import { mocks, utils } from "@wormhole-foundation/sdk-definitions/testing";

import { Wormhole, networkPlatformConfigs } from "./../src/index.js";

const network: "Testnet" = "Testnet";
type TNet = typeof network;
const allPlatformCtrs = platform.platforms.map((p) =>
  mocks.mockPlatformFactory(p, networkPlatformConfigs(network, p)),
) as any;

describe("Wormhole Tests", function () {
  let wh: Wormhole<TNet>;
  beforeEach(() => {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  let p: PlatformContext<TNet, any>;
  test("returns Platform", async function () {
    p = wh.getPlatform("Evm");
    expect(p).toBeTruthy();
  });

  let c: ChainContext<TNet, "Ethereum">;
  test("returns chain", async function () {
    c = wh.getChain("Ethereum");
    expect(c).toBeTruthy();
  });

  describe("getVaaBytes", () => {
    //test("returns vaa bytes", async function () {
    //  const vaa = await wh.getVaaBytes({
    //    chain: "Avalanche",
    //    emitter: utils.makeUniversalAddress("Avalanche"),
    //    sequence: 1n,
    //  });
    //  expect(vaa).toBeDefined();
    //});
    test("returns undefined when vaa bytes not found", async function () {
      publicRpcMock.givenSignedVaaNotFound();
      const vaa = await wh.getVaaBytes(
        { chain: "Aptos", emitter: utils.makeUniversalAddress("Aptos"), sequence: 1n },
        1,
      );
      expect(vaa).toBeNull();
    });
    //test("returns after first try fails", async function () {
    //  publicRpcMock.givenSignedVaaRequestWorksAfterRetry();
    //  const vaa = await wh.getVaaBytes({
    //    chain: "Base",
    //    emitter: utils.makeUniversalAddress("Base"),
    //    sequence: 1n,
    //  });
    //  expect(vaa).toBeDefined();
    //});
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
