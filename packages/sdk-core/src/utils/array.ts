import { hexlify } from 'ethers/lib/utils.js';

export const uint8ArrayToHex = (a: Uint8Array): string =>
  Buffer.from(a).toString('hex');

export const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith('0x')) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, 'hex'));
};

export function chunks<T>(array: T[], size: number): T[][] {
  // @ts-ignore
  return Array.apply<number, T[], T[][]>(
    0,
    new Array(Math.ceil(array.length / size)),
  ).map((_, index) => array.slice(index * size, (index + 1) * size));
}

export function textToHexString(name: string): string {
  return Buffer.from(name, 'binary').toString('hex');
}

export function textToUint8Array(name: string): Uint8Array {
  return new Uint8Array(Buffer.from(name, 'binary'));
}

export function hex(x: string): Buffer {
  return Buffer.from(
    hexlify(x, { allowMissingPrefix: true }).substring(2),
    'hex',
  );
}

export function ensureHexPrefix(x: string): string {
  return x.substring(0, 2) !== '0x' ? `0x${x}` : x;
}

export function stripHexPrefix(val: string) {
  return val.startsWith('0x') ? val.slice(2) : val;
}
