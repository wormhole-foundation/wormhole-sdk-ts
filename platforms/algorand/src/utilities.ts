import { Algodv2, modelsv2 } from "algosdk";

export const MAX_SIGS_PER_TXN: number = 6;

export const ALGO_VERIFY_HASH = "EZATROXX2HISIRZDRGXW4LRQ46Z6IUJYYIHU3PJGP7P5IQDPKVX42N767A";

export const ALGO_VERIFY = new Uint8Array([
  6, 32, 4, 1, 0, 32, 20, 38, 1, 0, 49, 32, 50, 3, 18, 68, 49, 1, 35, 18, 68, 49, 16, 129, 6, 18,
  68, 54, 26, 1, 54, 26, 3, 54, 26, 2, 136, 0, 3, 68, 34, 67, 53, 2, 53, 1, 53, 0, 40, 53, 240, 40,
  53, 241, 52, 0, 21, 53, 5, 35, 53, 3, 35, 53, 4, 52, 3, 52, 5, 12, 65, 0, 68, 52, 1, 52, 0, 52, 3,
  129, 65, 8, 34, 88, 23, 52, 0, 52, 3, 34, 8, 36, 88, 52, 0, 52, 3, 129, 33, 8, 36, 88, 7, 0, 53,
  241, 53, 240, 52, 2, 52, 4, 37, 88, 52, 240, 52, 241, 80, 2, 87, 12, 20, 18, 68, 52, 3, 129, 66,
  8, 53, 3, 52, 4, 37, 8, 53, 4, 66, 255, 180, 34, 137,
]);

export function safeBigIntToNumber(b: bigint): number {
  if (b < BigInt(Number.MIN_SAFE_INTEGER) || b > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Integer is unsafe");
  }
  return Number(b);
}

/**
 * Checks if the asset has been opted in by the receiver
 * @param client Algodv2 client
 * @param asset Algorand asset index
 * @param receiver Account address
 * @returns Promise with True if the asset was opted in, False otherwise
 */
export async function isOptedIn(client: Algodv2, address: string, asset: number): Promise<boolean> {
  try {
    const acctInfoResp = await client.accountAssetInformation(address, asset).do();
    const acctInfo = modelsv2.AccountAssetResponse.from_obj_for_encoding(acctInfoResp);
    return acctInfo.assetHolding.amount > 0;
  } catch {}
  return false;
}

// Useful for encoding numbers as varints to patch TEAL binary
export const varint = {
  // Forever grateful to https://github.com/joeltg/big-varint/blob/main/src/unsigned.ts
  _limit: 0x7f,
  encodingLength: (value: number) => {
    let i = 0;
    for (; value >= 0x80; i++) value >>= 7;
    return i + 1;
  },
  encode: (i: bigint | number, buffer?: ArrayBuffer, byteOffset?: number) => {
    if (typeof i === "bigint") i = safeBigIntToNumber(i);

    if (i < 0) throw new RangeError("value must be unsigned");

    const byteLength = varint.encodingLength(i);
    buffer = buffer || new ArrayBuffer(byteLength);
    byteOffset = byteOffset || 0;

    if (buffer.byteLength < byteOffset + byteLength)
      throw new RangeError("the buffer is too small to encode the number at the offset");

    const array = new Uint8Array(buffer, byteOffset);

    let offset = 0;
    while (varint._limit < i) {
      array[offset++] = (i & varint._limit) | 0x80;
      i >>= 7;
    }
    array[offset] = Number(i);
    return array;
  },
  decode: (data: Uint8Array, offset = 0) => {
    let i = 0;
    let n = 0;
    let b: number | undefined;
    do {
      b = data[offset + n];
      if (b === undefined) throw new RangeError("offset out of range");

      i += (b & varint._limit) << (n * 7);
      n++;
    } while (0x80 <= b);
    return i;
  },
};
