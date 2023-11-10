import * as publicRpcMock from "./mocks/publicrpc";
import {
  TokenBridge,
  Platform,
  RpcConnection,
  ChainContext,
  testing,
  supportsTokenBridge,
} from "@wormhole-foundation/sdk-definitions";
import {
  Network,
  Platform,
  platforms,
} from "@wormhole-foundation/sdk-base";
import { CONFIG, Wormhole } from "../src";
import { test, describe, expect } from '@jest/globals';

const network: Network = "Devnet";
const allPlatformCtrs = platforms.map((p) => {
  return testing.mocks.mockPlatformFactory(network, p, CONFIG[network].chains);
});

describe("Wormhole Tests", () => {
  let wh: Wormhole;
  beforeEach(() => {
    wh = new Wormhole(network, allPlatformCtrs);
  });

  let p: Platform<Platform>;
  test("returns Platform", async () => {
    p = wh.getPlatform("Ethereum");
    expect(p).toBeTruthy();
  });

  let c: ChainContext<Platform>;
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
  let p: Platform<Platform>;
  beforeEach(() => {
    const wh = new Wormhole(network, allPlatformCtrs);
    p = wh.getPlatform("Ethereum");
  });

  let rpc: RpcConnection<Platform>;
  test("Gets RPC", () => {
    rpc = p.getRpc("Ethereum");
    expect(rpc).toBeTruthy();
  });

  let tb: TokenBridge<Platform>;
  test("Gets Token Bridge", async () => {
    if (!supportsTokenBridge(p)) throw new Error("Fail");

    tb = await p.getTokenBridge(rpc);
    expect(tb).toBeTruthy();
  });
});

describe("Chain Tests", () => {
  let c: ChainContext<Platform>;
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
