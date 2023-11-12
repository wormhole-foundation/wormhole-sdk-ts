import * as publicRpcMock from "./mocks/publicrpc"; // Should be first
import { describe, expect, test } from '@jest/globals';
import {
  Chain,
  Network,
  Platform,
  platform,
} from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  PlatformContext,
  RpcConnection,
  testing
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole, networkPlatformConfigs } from "../src";

const network: Network = "Testnet";
const allPlatformCtrs = platform.platforms.map((p) => testing.mocks.mockPlatformFactory(network, p, networkPlatformConfigs(network, p)));

describe("Wormhole Tests", () => {
  let wh: Wormhole;
  beforeEach(() => {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  let p: PlatformContext<Network, Platform>;
  test("returns Platform", async () => {
    p = wh.getPlatform("Evm");
    expect(p).toBeTruthy();
  });

  let c: ChainContext<Network, Platform, Chain>;
  test("returns chain", async () => {
    c = wh.getChain("Ethereum");
    expect(c).toBeTruthy();
  });

  describe("getVaaBytes", () => {
    test("returns vaa bytes", async () => {
      const vaa = await wh.getVaaBytes(
        "Arbitrum",
        testing.utils.makeChainAddress("Arbitrum").address,
        1n,
      );
      expect(vaa).toBeDefined();
    });

    test("returns undefined when vaa bytes not found", async () => {
      publicRpcMock.givenSignedVaaNotFound();
      const vaa = await wh.getVaaBytes(
        "Aptos",
        testing.utils.makeChainAddress("Aptos").address,
        1n,
        1,
      );
      expect(vaa).toBeUndefined();
    });

    test("returns after first try fails", async () => {
      publicRpcMock.givenSignedVaaRequestWorksAfterRetry();
      const vaa = await wh.getVaaBytes(
        "Base",
        testing.utils.makeChainAddress("Base").address,
        1n,
      );
      expect(vaa).toBeDefined();
    });
  });
});

describe("Platform Tests", () => {
  let p: PlatformContext<Network, Platform>;
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
  let c: ChainContext<Network, Platform, Chain>;
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
