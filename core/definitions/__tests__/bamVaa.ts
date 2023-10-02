import "../src/payloads/bam";
import { deserialize, deserializePayload } from "../src/vaa";

const cases = [
  "AQAAAAABAIoYgY9KWhpDVdehi/6jlPnKwiZPMXrE103Pmqm+d0inIdgSnSYcUjExiGB18t2UKDjhbCo+alECY4jXJ1t2iXoAZRML0AAAAAAAAgAAAAAAAAAAAAAAAHmVUoxxQayZCePil5D8T4JCGCRPAAAAAAAAAADKuwAAAAAAAAAAAAAAHgAURPv+4K+O+p5YB2CET2FZqOISS1MAFET7/uCvjvqeWAdghE9hWajiEktTAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
];

const magicByte = 0xBB;
const baseGoerliId = 30;
const goerliBamAppAddress = '44fbfee0af8efa9e580760844f6159a8e2124b53';
// these two contracts are deployed at the same address, made 2 variables to avoid confusion
const baseGoerliBamAppAddress = goerliBamAppAddress;
const content = '0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000';

describe("BAM VAA tests", function () {
  it("should correctly deserialize and reserialize a BAM VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = Buffer.from(testCase, "base64");

      const parsed = deserialize("Uint8Array", new Uint8Array(vaaBytes));

      const x = deserializePayload("BAMessage", parsed.payload);
      expect(x).toBeTruthy();
      expect(x.magicByte).toEqual(magicByte);
      expect(x.targetChain).toEqual(baseGoerliId);
      const targetAddress = Buffer.from(x.targetAddress).toString('hex');
      expect(targetAddress).toEqual(goerliBamAppAddress);
      const senderAddress = Buffer.from(x.targetAddress).toString('hex');
      expect(senderAddress).toEqual(baseGoerliBamAppAddress);
      const parsedContent = Buffer.from(x.contents).toString('hex');
      expect(parsedContent).toEqual(content);
    }
  });
});
