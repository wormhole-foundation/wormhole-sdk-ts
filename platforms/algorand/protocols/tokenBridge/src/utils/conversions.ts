export function safeBigIntToNumber(b: bigint): number {
  if (
    b < BigInt(Number.MIN_SAFE_INTEGER) ||
    b > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('integer is unsafe');
  }
  return Number(b);
}

export const uint8ArrayToHex = (a: Uint8Array): string =>
  Buffer.from(a).toString('hex');

export function textToHexString(name: string): string {
  return Buffer.from(name, 'binary').toString('hex');
}

export function textToUint8Array(name: string): Uint8Array {
  return new Uint8Array(Buffer.from(name, 'binary'));
}

export function hexToNativeAssetBigIntAlgorand(s: string): bigint {
  // in case not in hex format
  s = s.slice(0, 2) !== '0x' ? '0x' + s : s;
  return BigInt(s);
}

export const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith('0x')) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, 'hex'));
};
