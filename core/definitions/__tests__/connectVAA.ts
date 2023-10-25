import "../src/payloads/connect";
import { encoding } from "@wormhole-foundation/sdk-base";
import { deserialize, deserializePayload } from "../src/vaa";

const cases = [
  "AQAAAAABANyb1oS4sD9gIp0m+dKOYmrEaxx3OeWWtUbim+6oL7VnX/zUXa/di9lA0SSDRZ3DCWoqgDC4pjPoMNUNLn1P3EcAZJjzeAAAAAAAAgAAAAAAAAAAAAAAAAppFGcWs6IWIih++hYHQkxmMGmkAAAAAAAAAHDIAQAAAAAAAAAAAAAAAAeGXG6HufcCVTd+AkrOZjDB6qN/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB6EgAAAAAAAAAAAwAAAAAAA5CKAAAAAAAAAAAAAAAAF9of9ThtBExj8AdHtbitHjgGRI0AAAAAAAAAAAAAAAC/aD1UHhEyBBjKeOwTMJk45sWSLwBhAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYagAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAInU4Tn/aAHroyfjAatH6hXg4Srg==",
];

describe("CCTP Transfer VAA tests", function () {
  it("should correctly deserialize and reserialize a CCTP Transfer Relay VAA", function () {
    for (const testCase of cases) {
      const vaaBytes = encoding.b64.decode(testCase);

      const parsed = deserialize("Uint8Array", vaaBytes);

      const x = deserializePayload("CCTP:TransferRelay", parsed.payload);
      expect(x).toBeTruthy();
      // ...
    }
  });
});
