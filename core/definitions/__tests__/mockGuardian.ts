import { encoding } from "@wormhole-foundation/sdk-base";
import { SignatureUtils, VAA, keccak256 } from "../src/index.js";
import { MockEmitter, MockGuardians } from "../src/testing/mocks/guardian.js";
import { makeUniversalAddress } from "../src/testing/utils/index.js";

const GUARDIAN_KEY = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const TEST_CHAIN = "Ethereum";

describe("Mock Emitter Tests", function () {});

describe("Mock Guardian Tests", function () {
  const address = makeUniversalAddress(TEST_CHAIN);
  let gset: MockGuardians;
  let emitter: MockEmitter;

  it("Should create a Guardian set", function () {
    gset = new MockGuardians(0, [GUARDIAN_KEY]);
    expect(gset.getPublicKeys()).toHaveLength(1);
  });

  it("Should create an Emitter", function () {
    emitter = new MockEmitter(address, TEST_CHAIN);
    expect(emitter.chain).toEqual(TEST_CHAIN);
  });

  let msg: Uint8Array;
  it("Should publish a message", function () {
    const payload = encoding.bytes.encode("lol");
    msg = emitter.publishMessage(0, payload, 200);
    expect(msg).toHaveLength(57 + payload.length);
  });

  let signedVaa: VAA<"Uint8Array">;
  it("Should sign the message published", function () {
    signedVaa = gset.addSignatures(msg, [0]);
  });

  it("Should validate the VAA its just signed", function () {
    // rehash the hash since we use double hash for sign
    const hash = keccak256(signedVaa.hash);
    const pubKeys = gset.getPublicKeys();
    for (const sig of signedVaa.signatures) {
      const pubkey = pubKeys[sig.guardianIndex]!;
      const valid = SignatureUtils.validate(sig.signature, pubkey, hash);
      expect(valid).toBeTruthy();
    }
  });

  it("Should recover the public key from the signature and digest", function () {
    // rehash the hash since we use double hash for sign
    const hash = keccak256(signedVaa.hash);
    const pubKeys = gset.getPublicKeys();
    for (const sig of signedVaa.signatures) {
      const pubkey = pubKeys[sig.guardianIndex]!;
      const recovered = SignatureUtils.recover(sig.signature, hash);
      expect(encoding.bytes.equals(recovered, pubkey)).toBeTruthy();
    }
  });
});
