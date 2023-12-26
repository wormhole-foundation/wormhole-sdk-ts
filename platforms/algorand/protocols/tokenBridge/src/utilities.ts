import { bytesToBigInt } from "algosdk";

export function safeBigIntToNumber(b: bigint): number {
  if (b < BigInt(Number.MIN_SAFE_INTEGER) || b > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Integer is unsafe");
  }
  return Number(b);
}

export function extract3(buffer: Uint8Array, start: number, size: number) {
  return buffer.slice(start, start + size);
}

// export function uint8ArrayToNativeStringAlgorand(a: Uint8Array): string {
//   return encodeAddress(a);
// }

// export function hexToNativeStringAlgorand(s: string): string {
//   return uint8ArrayToNativeStringAlgorand(hexToUint8Array(s));
// }

// export function nativeStringToHexAlgorand(s: string): string {
//   return uint8ArrayToHex(decodeAddress(s).publicKey);
// }

export function hexToNativeAssetBigIntAlgorand(s: string): bigint {
  return bytesToBigInt(hexToUint8Array(s));
}

// export function hexToNativeAssetStringAlgorand(s: string): string {
//   return uint8ArrayToNativeStringAlgorand(hexToUint8Array(s));
// }

// hex.encode
export const uint8ArrayToHex = (a: Uint8Array): string => {
  return Buffer.from(a).toString("hex");
};

export const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith("0x")) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, "hex"));
};

export function textToHexString(name: string): string {
  return Buffer.from(name, "binary").toString("hex");
}

// TODO: bytes.encode
export function textToUint8Array(name: string): Uint8Array {
  return new Uint8Array(Buffer.from(name, "binary"));
}
