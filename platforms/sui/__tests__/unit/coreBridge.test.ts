import { describe, expect, test } from "@jest/globals";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { CONFIG } from "@wormhole-foundation/sdk-connect";
import { SuiWormholeCore } from "@wormhole-foundation/sdk-sui-core";

const network = "Mainnet" as const;
const chain = "Sui" as const;

// Event values observed from a historical mainnet WormholeMessage; the test
// drives parseMessages with a synthetic response so it exercises parser logic
// rather than depending on indexer retention of any particular tx digest.
const EMITTER_HEX = "0x89b91e68d0264956632bf11f8abd2243caa56c4a42c97d9b97eadc71bf1074bf";
const SEQUENCE = 174412n;
const PAYLOAD_B64 = "AQIDBA==";

const FAKE_DIGEST = "0xdeadbeef";

type GetTransactionArgs = { digest: string; include: { events: boolean } };
type GetTransactionResult = {
  Transaction?: { events?: Array<{ eventType: string; json: unknown }> };
  FailedTransaction?: { events?: Array<{ eventType: string; json: unknown }> };
};

class StubSuiGrpcClient {
  constructor(private readonly response: GetTransactionResult) {}
  async getTransaction(_opts: GetTransactionArgs): Promise<GetTransactionResult> {
    return this.response;
  }
}

const wormholeMessageResponse: GetTransactionResult = {
  Transaction: {
    events: [
      {
        eventType:
          "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c::publish_message::WormholeMessage",
        json: {
          sender: EMITTER_HEX,
          sequence: SEQUENCE.toString(),
          consistency_level: 0,
          nonce: 0,
          payload: PAYLOAD_B64,
          timestamp: "1700000000",
        },
      },
    ],
  },
};

describe("SuiWormholeCore", () => {
  const contracts = CONFIG[network].chains[chain]!.contracts;
  const provider = new StubSuiGrpcClient(wormholeMessageResponse) as unknown as SuiGrpcClient;
  const core = new SuiWormholeCore(network, chain, provider, contracts);

  test("parseTransaction → WormholeMessageId(s)", async () => {
    const msgs = await core.parseTransaction(FAKE_DIGEST);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.chain).toEqual(chain);
    expect(msgs[0]!.emitter.toString()).toEqual(EMITTER_HEX);
    expect(msgs[0]!.sequence).toEqual(SEQUENCE);
  });

  test("parseMessages → emitter/sequence/payload from the event", async () => {
    const msgs = await (core as any).parseMessages(FAKE_DIGEST);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.emitterAddress.toString()).toEqual(EMITTER_HEX);
    expect(msgs[0]!.sequence).toEqual(SEQUENCE);
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
