import "../src/payloads/connect";
import { deserialize, deserializePayload } from "../src/vaa";

const cases = [
  "AQAAAAABAIoYgY9KWhpDVdehi/6jlPnKwiZPMXrE103Pmqm+d0inIdgSnSYcUjExiGB18t2UKDjhbCo+alECY4jXJ1t2iXoAZRML0AAAAAAAAgAAAAAAAAAAAAAAAHmVUoxxQayZCePil5D8T4JCGCRPAAAAAAAAAADKuwAAAAAAAAAAAAAAHgAURPv+4K+O+p5YB2CET2FZqOISS1MAFET7/uCvjvqeWAdghE9hWajiEktTAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
];

describe("BAM VAA tests", function () {
  it("should correctly deserialize and reserialize a BAM VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = Buffer.from(testCase, "base64");

      const parsed = deserialize("Uint8Array", new Uint8Array(vaaBytes));

      console.log('PARSED BAM', parsed)
      const x = deserializePayload("BAMessage", parsed.payload);
      console.log('DESERIALIZED BAM', x)
      expect(x).toBeTruthy();
    }
  });
});
