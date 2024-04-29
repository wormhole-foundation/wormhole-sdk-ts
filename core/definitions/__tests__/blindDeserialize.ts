import { encoding } from "@wormhole-foundation/sdk-base";
import {
  blindDeserializePayload,
  deserialize,
  deserializePayload,
  exhaustiveDeserialize,
} from "../src/index.js";
import "../src/protocols/index.js";

const cases = [
  "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",
];

describe("Blind Deserialize", function () {
  it("Should deserialize a blind message", function () {
    for (const c of cases) {
      const decoded = encoding.b64.decode(c);
      const vaa = deserialize("Uint8Array", decoded);
      const actual = deserializePayload("TokenBridge:Transfer", vaa.payload);
      expect(actual).toBeDefined();

      console.time("exhaustive");
      const result = exhaustiveDeserialize(vaa.payload);
      expect(result).toHaveLength(1);
      console.timeEnd("exhaustive");

      console.time("blind");
      const blind = blindDeserializePayload(vaa.payload);
      expect(blind).toHaveLength(1);
      console.timeEnd("blind");
    }
  });
});
