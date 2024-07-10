import { base16, base64, base58 } from "@scure/base";

export { bech32 } from "@scure/base";

/** Utility method to strip a given prefix, frequently used to remove '0x' from an address */
export const stripPrefix = (prefix: string, str: string): string =>
  str.startsWith(prefix) ? str.slice(prefix.length) : str;

const isHexRegex = /^(?:0x)?[0-9a-fA-F]+$/;

/** Base16/Hex encoding and decoding utilities */
export const hex = {
  /** check if a string is valid hex */
  valid: (input: string) => isHexRegex.test(input),
  /** decode a hex string to Uint8Array */
  decode: (input: string) => base16.decode(stripPrefix("0x", input).toUpperCase()),
  /** encode a string or Uint8Array to hex */
  encode: (input: string | Uint8Array, prefix: boolean = false) => {
    input = typeof input === "string" ? bytes.encode(input) : input;
    return (prefix ? "0x" : "") + base16.encode(input).toLowerCase();
  },
};

// regex string to check if the input could possibly be base64 encoded.
// WARNING: There are clear text strings that are NOT base64 encoded that will pass this check.
const isB64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Base64 encoding and decoding utilities */
export const b64 = {
  /** check if a string is valid base64 */
  valid: (input: string) => isB64Regex.test(input),
  /** decode a base64 string to Uint8Array */
  decode: base64.decode,
  /** encode a string or Uint8Array to base64 */
  encode: (input: string | Uint8Array) =>
    base64.encode(typeof input === "string" ? bytes.encode(input) : input),
};

/** Base58 encoding and decoding utilities */
export const b58 = {
  /** decode a base58 string to Uint8Array */
  decode: base58.decode,
  /** encode a string or Uint8Array to base58 */
  encode: (input: string | Uint8Array) =>
    base58.encode(typeof input === "string" ? bytes.encode(input) : input),
};

/** BigInt encoding and decoding utilities */
export const bignum = {
  /** decode a hex string or bytes to a bigint */
  decode: (input: string | Uint8Array) => {
    if (typeof input !== "string") input = hex.encode(input, true);
    if (input === "" || input === "0x") return 0n;
    return BigInt(input);
  },
  /** encode a bigint as a hex string */
  encode: (input: bigint, prefix: boolean = false) => bignum.toString(input, prefix),
  /** convert a bigint to a hexstring */
  toString: (input: bigint, prefix: boolean = false) => {
    let str = input.toString(16);
    str = str.length % 2 === 1 ? (str = "0" + str) : str;
    if (prefix) return "0x" + str;
    return str;
  },
  /** convert a bigint or number to bytes, 
   *   optionally specify length, left padded with 0s to length
   */
  toBytes: (input: bigint | number, length?: number) => {
    if (typeof input === "number") input = bignum.toBigInt(input);
    const b = hex.decode(bignum.toString(input));
    if (!length) return b;
    if (length < b.length) throw new Error(`Can't fit ${input} into ${length} bytes.`);
    return bytes.zpad(b, length);
  },
  /** safe cast from bigint to number */
  toNumber: (input: bigint) => {
    if (input > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error(`Invalid cast: ${input} exceeds MAX_SAFE_INTEGER`);

    return Number(input);
  },
  /** safe cast from number to bigint */
  toBigInt: (input: number) => {
    if (input > Number.MAX_SAFE_INTEGER)
      throw new Error(`Invalid cast: ${input} exceeds MAX_SAFE_INTEGER`);

    return BigInt(input);
  }
};

/** Uint8Array encoding and decoding utilities */
export const bytes = {
  /** encode a string to Uint8Array */
  encode: (value: string): Uint8Array => new TextEncoder().encode(value),
  /** decode a Uint8Array to string */
  decode: (value: Uint8Array): string => new TextDecoder().decode(value),
  /** compare two Uint8Arrays for equality */
  equals: (lhs: Uint8Array, rhs: Uint8Array): boolean =>
    lhs.length === rhs.length && lhs.every((v, i) => v === rhs[i]),
  /** pad a Uint8Array to a given length, optionally specifying padding direction */
  zpad: (arr: Uint8Array, length: number, padStart: boolean = true): Uint8Array =>
    padStart
      ? bytes.concat(new Uint8Array(length - arr.length), arr)
      : bytes.concat(arr, new Uint8Array(length - arr.length)),
  /** concatenate multiple Uint8Arrays into a single Uint8Array */
  concat: (...args: Uint8Array[]): Uint8Array => {
    const length = args.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    args.forEach((arg) => {
      result.set(arg, offset);
      offset += arg.length;
    });
    return result;
  },
};
