import { encoding } from "@wormhole-foundation/sdk-base";
import "../src/payloads/bam";
import { deserialize, serializePayload } from "../src/vaa";

const payloadLiteral = "BAM:Message";
const goerliBamAppAddress = "0x44fbfee0af8efa9e580760844f6159a8e2124b53";
// these two contracts are deployed at the same address, made 2 variables to avoid confusion
const baseGoerliBamAppAddress = goerliBamAppAddress;

const cases = [
  {
    vaa: "AQAAAAABAIoYgY9KWhpDVdehi/6jlPnKwiZPMXrE103Pmqm+d0inIdgSnSYcUjExiGB18t2UKDjhbCo+alECY4jXJ1t2iXoAZRML0AAAAAAAAgAAAAAAAAAAAAAAAHmVUoxxQayZCePil5D8T4JCGCRPAAAAAAAAAADKuwAAAAAAAAAAAAAAHgAURPv+4K+O+p5YB2CET2FZqOISS1MAFET7/uCvjvqeWAdghE9hWajiEktTAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    targetChain: "Base",
    targetAddress: baseGoerliBamAppAddress,
    senderAddress: goerliBamAppAddress,
    contents:
      "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000",
    payload:
      "0xbb00000000000000000000001e001444fbfee0af8efa9e580760844f6159a8e2124b53001444fbfee0af8efa9e580760844f6159a8e2124b5300600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000",
  },
];

describe("BAM VAA tests", function () {
  it("should correctly deserialize a BAM VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = encoding.b64.decode(testCase.vaa);

      const { payload } = deserialize(payloadLiteral, vaaBytes);

      const targetAddress = encoding.hex.encode(payload.targetAddress, true);
      const senderAddress = encoding.hex.encode(payload.senderAddress, true);
      const parsedContents = encoding.hex.encode(
        payload.contents as Uint8Array, true
      );

      expect(payload).toBeTruthy();
      expect(payload.targetChain).toEqual(testCase.targetChain);
      expect(targetAddress).toEqual(testCase.targetAddress);
      expect(senderAddress).toEqual(testCase.senderAddress);
      expect(parsedContents).toEqual(testCase.contents);
    }
  });

  it("should correctly serialize a BAM VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = encoding.b64.decode(testCase.vaa);

      const { payload } = deserialize(payloadLiteral, vaaBytes);

      // TODO: this fn might return a payload somehow, not uint8array?
      const serialized: Uint8Array = serializePayload(payloadLiteral, payload);

      const serializedHex = encoding.hex.encode(serialized, true);
      expect(serializedHex).toEqual(testCase.payload);
    }
  });
});
