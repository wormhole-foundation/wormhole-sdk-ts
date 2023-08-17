import { VAA, deserialize } from "../src/vaa";
import "../src/payloads/tokenBridge";

const original =
  "AQAAAAABAMysWsb94YzZxLiJtKr4hcT2qA/+8laXmeZiEtmVZ5kidTdadwYiXfowVtlUtMWNv1PHIU/eH4T1EI/aI6uhW/kBZN0dygAAAAAADgAAAAAAAAAAAAAAAAXKYDfsUfi3Eu0ub6ciGf6udOFTAAAAAAAAAdUBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUk2Xpn9Q9KBiwox09gcDrskCipQADgAAAAAAAAAAAAAAAGYDtKfinfvbYVnDlakV50dXwfsTAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

describe("Token Transfer VAA tests", function () {
  it("should correctly deserialize and reserialize a transfer VAA", function () {
    const vaaBytes = new Uint8Array(Buffer.from(original, "base64"));

    const parsed: VAA<"Transfer"> = deserialize("Transfer", vaaBytes);
    expect(parsed.payload.token.amount).toBe(0n);
    expect(parsed.payload.to.chain).toBe("Ethereum");
  });
});
