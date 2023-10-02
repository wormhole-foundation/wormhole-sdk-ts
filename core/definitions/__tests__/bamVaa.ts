import "../src/payloads/bam";
import { deserialize, deserializePayload, serializePayload } from "../src/vaa";

const payloadLiteral = "BAMessage";
const magicByte = 0xBB;
const baseGoerliId = 30;
const goerliBamAppAddress = "44fbfee0af8efa9e580760844f6159a8e2124b53";
// these two contracts are deployed at the same address, made 2 variables to avoid confusion
const baseGoerliBamAppAddress = goerliBamAppAddress;

const cases = [
  {
    vaa: "AQAAAAABAIoYgY9KWhpDVdehi/6jlPnKwiZPMXrE103Pmqm+d0inIdgSnSYcUjExiGB18t2UKDjhbCo+alECY4jXJ1t2iXoAZRML0AAAAAAAAgAAAAAAAAAAAAAAAHmVUoxxQayZCePil5D8T4JCGCRPAAAAAAAAAADKuwAAAAAAAAAAAAAAHgAURPv+4K+O+p5YB2CET2FZqOISS1MAFET7/uCvjvqeWAdghE9hWajiEktTAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    targetChain: baseGoerliId,
    targetAddress: baseGoerliBamAppAddress,
    senderAddress: goerliBamAppAddress,
    contents: "0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000",
    payload: "bb00000000000000000000001e001444fbfee0af8efa9e580760844f6159a8e2124b53001444fbfee0af8efa9e580760844f6159a8e2124b5300600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000",
  }
];


describe("BAM VAA tests", function () {
  it("should correctly deserialize a BAM VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = Buffer.from(testCase.vaa, "base64");

      const parsed = deserialize("Uint8Array", new Uint8Array(vaaBytes));
      const x = deserializePayload(payloadLiteral, parsed.payload);

      const targetAddress = Buffer.from(x.targetAddress).toString("hex");
      const senderAddress = Buffer.from(x.targetAddress).toString("hex");
      const parsedContents = Buffer.from(x.contents).toString("hex");

      expect(x).toBeTruthy();
      expect(x.magicByte).toEqual(magicByte);
      expect(x.targetChain).toEqual(testCase.targetChain);
      expect(targetAddress).toEqual(testCase.targetAddress);
      expect(senderAddress).toEqual(testCase.senderAddress);
      expect(parsedContents).toEqual(testCase.contents);
    }
  });

  it("should correctly serialize a BAM VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = Buffer.from(testCase.vaa, "base64");

      const parsed = deserialize("Uint8Array", new Uint8Array(vaaBytes));

      const x = deserializePayload(payloadLiteral, parsed.payload);
      const serialized = serializePayload(payloadLiteral, x);
      const serializedHex = Buffer.from(serialized).toString("hex");
      expect(serializedHex).toEqual(testCase.payload);
    }
  })
});
