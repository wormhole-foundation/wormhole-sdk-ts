import { deserializeUnknownVaa } from "../src/vaa/index.js";

const headerLen = 1 + 4 + 1 + 1 + 65; // version + guardianSet + sigCount + (guardianIndex + signature)
const envelopeLen = 4 + 4 + 2 + 32 + 8 + 1;

const buildVaa = (payload: Uint8Array): Uint8Array => {
  const data = new Uint8Array(headerLen + envelopeLen + payload.length);
  const view = new DataView(data.buffer);

  view.setUint8(0, 1); // version
  view.setUint32(1, 7); // guardian set index
  view.setUint8(5, 1); // signature count
  view.setUint8(6, 0); // guardian index
  data.fill(0xaa, 7, 7 + 65); // signature

  view.setUint32(headerLen, 1700000000); // timestamp
  view.setUint32(headerLen + 4, 42); // nonce
  view.setUint16(headerLen + 8, 65535); // emitter chain, unknown to the SDK
  data.fill(0x11, headerLen + 10, headerLen + 42); // emitter address
  view.setBigUint64(headerLen + 42, 3n); // sequence
  view.setUint8(headerLen + 50, 1); // consistency level

  data.set(payload, headerLen + envelopeLen);
  return data;
};

describe("Unknown VAA deserialization", function () {
  it("should return exactly the payload bytes of a VAA from an unknown chain", function () {
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
    const vaa = deserializeUnknownVaa(buildVaa(payload));

    expect(vaa.timestamp).toBe(1700000000);
    expect(vaa.nonce).toBe(42);
    expect(vaa.emitterChain).toBe(65535);
    expect(vaa.sequence).toBe(3n);
    expect(vaa.consistencyLevel).toBe(1);
    expect(vaa.payload).toEqual(payload);
  });
});
