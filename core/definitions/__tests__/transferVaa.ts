import { VAA, deserialize } from "../src/vaa";
import "../src/payloads/tokenBridge";
import { tokenBridgePayloads } from "../src/payloads/tokenBridge";

const cases = [
  "AQAAAAABAMysWsb94YzZxLiJtKr4hcT2qA/+8laXmeZiEtmVZ5kidTdadwYiXfowVtlUtMWNv1PHIU/eH4T1EI/aI6uhW/kBZN0dygAAAAAADgAAAAAAAAAAAAAAAAXKYDfsUfi3Eu0ub6ciGf6udOFTAAAAAAAAAdUBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUk2Xpn9Q9KBiwox09gcDrskCipQADgAAAAAAAAAAAAAAAGYDtKfinfvbYVnDlakV50dXwfsTAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  "AQAAAAABAD/A72/ZwTe/pPNRmPLLf3qZY+od9NEqvGEFBv0lHhgJdBmBo4m9cBn2Fb/03XkfFrwM00YQgnmM883tENNnBY8BZOWtSQg8AQAABgAAAAAAAAAAAAAAAGHkTlBspWWebAu6m2eFhvotcpdWAAAAAAAAHWcBAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHoSAAAAAAAAAAAAAAAAAnDySg9PkSFRpfNItP6okDPsDKIkABW2a5rLTM8HWUwGlnaPu04jKXcYMsSSWWEt1y+axX9vtACAAAAAAAAAAAAAAAADUkwZkmKzkCQWf2kwbzS5z2M/+AXsiYmFzaWNfcmVjaXBpZW50Ijp7InJlY2lwaWVudCI6ImMyVnBNVFJqTldVM1pYWjJZM0JvZFdvMGFEaHVjWGxrWm01ek16SXdPWFptYW5SbWFtUndaVGhqIn19",
];

//const original =
describe("Token Transfer VAA tests", function () {
  it("skip", () => {});
  // it("should correctly deserialize and reserialize a transfer VAA", function () {
  //   for (const testCase of cases) {
  //     const vaaBytes = new Uint8Array(Buffer.from(testCase, "base64"));
  //     let parsed:
  //       | VAA<"Transfer" | "TransferWithPayload" | "AttestMeta">
  //       | undefined;
  //     for (const maybeType of tokenBridgePayloads) {
  //       try {
  //         parsed = deserialize(maybeType[0], vaaBytes);
  //       } catch (e) {}
  //     }
  //     if (parsed === undefined) {
  //       throw new Error(`Couldn't deserialize VAA: ${testCase}`);
  //     }
  //   }
  // });
});
