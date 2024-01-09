import { encoding } from '@wormhole-foundation/sdk-base'
import { payloadDiscriminator, deserialize } from "../src/vaa";
import "../src/payloads/tokenBridge";

const cases = [
  ["Transfer", "AQAAAAABAMysWsb94YzZxLiJtKr4hcT2qA/+8laXmeZiEtmVZ5kidTdadwYiXfowVtlUtMWNv1PHIU/eH4T1EI/aI6uhW/kBZN0dygAAAAAADgAAAAAAAAAAAAAAAAXKYDfsUfi3Eu0ub6ciGf6udOFTAAAAAAAAAdUBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUk2Xpn9Q9KBiwox09gcDrskCipQADgAAAAAAAAAAAAAAAGYDtKfinfvbYVnDlakV50dXwfsTAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="],
  ["TransferWithPayload", "AQAAAAABAD/A72/ZwTe/pPNRmPLLf3qZY+od9NEqvGEFBv0lHhgJdBmBo4m9cBn2Fb/03XkfFrwM00YQgnmM883tENNnBY8BZOWtSQg8AQAABgAAAAAAAAAAAAAAAGHkTlBspWWebAu6m2eFhvotcpdWAAAAAAAAHWcBAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHoSAAAAAAAAAAAAAAAAAnDySg9PkSFRpfNItP6okDPsDKIkABW2a5rLTM8HWUwGlnaPu04jKXcYMsSSWWEt1y+axX9vtACAAAAAAAAAAAAAAAADUkwZkmKzkCQWf2kwbzS5z2M/+AXsiYmFzaWNfcmVjaXBpZW50Ijp7InJlY2lwaWVudCI6ImMyVnBNVFJqTldVM1pYWjJZM0JvZFdvMGFEaHVjWGxrWm01ek16SXdPWFptYW5SbWFtUndaVGhqIn19"],
];

//const original =
describe("Token Transfer VAA tests", function () {
  const discriminator = payloadDiscriminator(
    ["TokenBridge", ["AttestMeta", "Transfer", "TransferWithPayload"]]
  );
  it("should correctly deserialize and reserialize a transfer VAA", function () {
    for (const [payloadName, encoded] of cases) {
      const vaaBytes = encoding.b64.decode(encoded);
      const vaa = deserialize(discriminator, vaaBytes);
      expect(vaa.payloadName).toBe(payloadName);
    }
  });
});
