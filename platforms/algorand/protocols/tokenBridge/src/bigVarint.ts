// Forever grateful to https://github.com/joeltg/big-varint/blob/main/src/unsigned.ts

import { encoding } from "@wormhole-foundation/connect-sdk";

// Useful for encoding numbers as varints to patch TEAL binary
export const varint = {
  encodingLength: (value: bigint) => {
    let i = 0;
    for (; value >= BigInt(0x80); i++) {
      value >>= BigInt(7);
    }
    return i + 1;
  },

  encode: (i: bigint | number, buffer?: ArrayBuffer, byteOffset?: number) => {
    if (typeof i === "number") i = BigInt(i);

    const LIMIT = BigInt(0x7f);
    if (i < BigInt(0)) {
      throw new RangeError("value must be unsigned");
    }

    const byteLength = varint.encodingLength(i);
    buffer = buffer || new ArrayBuffer(byteLength);
    byteOffset = byteOffset || 0;
    if (buffer.byteLength < byteOffset + byteLength) {
      throw new RangeError("the buffer is too small to encode the number at the offset");
    }

    const array = new Uint8Array(buffer, byteOffset);

    let offset = 0;
    while (LIMIT < i) {
      array[offset++] = Number(i & LIMIT) | 0x80;
      i >>= BigInt(7);
    }

    array[offset] = Number(i);

    return array;
  },
  decode: (data: Uint8Array, offset = 0) => {
    let i = BigInt(0);
    let n = 0;
    let b: number | undefined;
    do {
      b = data[offset + n];
      if (b === undefined) {
        throw new RangeError("offset out of range");
      }

      i += BigInt(b & 0x7f) << BigInt(n * 7);
      n++;
    } while (0x80 <= b);
    return i;
  },
  encodeHex: (i: bigint | number, buffer?: ArrayBuffer, byteOffset?: number) => {
    return encoding.hex.encode(varint.encode(i, buffer, byteOffset));
  },
};
