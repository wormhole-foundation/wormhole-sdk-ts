import { base16, base64, base58 } from '@scure/base';


export const stripPrefix = (prefix: string, str: string): string =>
    str.startsWith(prefix) ? str.slice(prefix.length) : str;

// This function uses a regex string to check if the input could
// possibly be base64 encoded.
// WARNING:  There are clear text strings that are NOT base64 encoded
//           that will pass this check.
export function isBase64Encoded(input: string): boolean {
    const b64Regex = new RegExp('^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$');
    return b64Regex.test(input);
}


function isHexEncoded(input: string): boolean {
    const regex = /^[0-9a-fA-F]+$/;
    const normalized = stripPrefix('0x', input)
    return normalized.length % 2 === 0 && regex.test(normalized);
}

export const hex = {
    valid: isHexEncoded,
    decode: (input: string) => base16.decode(stripPrefix('0x', input).toUpperCase()),
    encode: (input: string | Uint8Array, prefix: boolean = false) => {
        input = typeof input === "string" ? toUint8Array(input) : input;
        return (prefix ? "0x" : "") + base16.encode(input).toLowerCase()
    }
}

export const b64 = {
    valid: isBase64Encoded,
    decode: base64.decode,
    encode: (input: string | Uint8Array) => base64.encode(typeof input === "string" ? toUint8Array(input) : input)
}

export const b58 = {
    decode: base58.decode,
    encode: (input: string | Uint8Array) => base58.encode(typeof input === "string" ? toUint8Array(input) : input),
}

export const bignum = {
    decode: (input: string) => BigInt(input),
    encode: (input: bigint, prefix: boolean = false) => (prefix ? "0x" : "") + input.toString(16)
}


export const toUint8Array = (value: string | bigint): Uint8Array => {
    if (typeof value === "bigint")
        return toUint8Array(bignum.encode(value))

    return (new TextEncoder()).encode(value);
}

export const fromUint8Array = (value: Uint8Array): string => {
    return (new TextDecoder()).decode(value);
}