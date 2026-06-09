import { describe, expect, test } from "@jest/globals";
import { CONFIG } from "@wormhole-foundation/sdk-connect";
import type { WormholeCore } from "@wormhole-foundation/sdk-connect";
import { SuiChains, SuiPlatform } from "./../../src/index.js";

import "@wormhole-foundation/sdk-sui-core";

/**
 * SuiWormholeCore (core bridge): parseTransaction / parseMessages against a fixed
 * historical mainnet WormholeMessage tx, plus the not-implemented method contract.
 *
 * Live Sui mainnet RPC. The tx digest is immutable so its parsed message is stable.
 */

const network: "Mainnet" = "Mainnet";
type TNet = typeof network;
const configs = CONFIG[network].chains;

// A real historical mainnet Sui tx that emitted a WormholeMessage event.
const WORMHOLE_MSG_TX = "3EFScgGaJLJjN4MgqkP6u4HzqReAAvbGQ1xKEQwZU7NM";
const EXPECTED = {
  chain: "Sui" as const,
  emitter: "0x89b91e68d0264956632bf11f8abd2243caa56c4a42c97d9b97eadc71bf1074bf",
  sequence: 174412n,
};

describe("SuiWormholeCore", () => {
  const p = new SuiPlatform(network, configs);
  const rpc = p.getRpc("Sui");

  let core: WormholeCore<TNet, SuiChains>;
  beforeAll(async () => {
    core = await p.getProtocol("WormholeCore", rpc);
  });

  test("parseTransaction → WormholeMessageId(s)", async () => {
    const msgs = await core.parseTransaction(WORMHOLE_MSG_TX);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.chain).toEqual(EXPECTED.chain);
    expect(msgs[0]!.emitter.toString()).toEqual(EXPECTED.emitter);
    expect(msgs[0]!.sequence).toEqual(EXPECTED.sequence);
  });

  test("parseMessages → emitter/sequence/payload from the event", async () => {
    const msgs = await (core as any).parseMessages(WORMHOLE_MSG_TX);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.emitterAddress.toString()).toEqual(EXPECTED.emitter);
    expect(msgs[0]!.sequence).toEqual(EXPECTED.sequence);
    expect(msgs[0]!.payload.length).toBeGreaterThan(0);
  });

  describe("not-implemented methods throw (documents current contract)", () => {
    test("getMessageFee throws", () => {
      expect(() => core.getMessageFee()).toThrow();
    });
    test("getGuardianSet throws", () => {
      expect(() => core.getGuardianSet(0)).toThrow();
    });
    test("getGuardianSetIndex rejects", async () => {
      await expect((core as any).getGuardianSetIndex()).rejects.toThrow();
    });
  });
});
