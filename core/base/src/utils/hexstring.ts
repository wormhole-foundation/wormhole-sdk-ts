export const stripPrefix = (prefix: string, str: string): string =>
  str.startsWith(prefix) ? str.slice(prefix.length) : str;

const tryAsciiHexCharToNumber = (str: string, index: number): number => {
  //we could use parseInt(char, 16) but given that we are doing this for every single char and
  //  parseInt has to check for optional "0x" prefix and other conversion stuff, let's just be
  //  explicit and not overly wasteful with performance
  const charCode = str.charCodeAt(index);
  switch (charCode) {
    case 48:
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return charCode - 48; //ascii 0-9 is 48-57
    case 65:
    case 66:
    case 67:
    case 68:
    case 69:
    case 70:
      return charCode - 65 + 10; //ascii A-F is 65-70
    case 97:
    case 98:
    case 99:
    case 100:
    case 101:
    case 102:
      return charCode - 97 + 10; //ascii a-f is 97-102
    default:
      return Number.NaN;
  }
};

const asciiHexCharToNumber = (str: string, index: number): number => {
  const val = tryAsciiHexCharToNumber(str, index);
  if (Number.isNaN(val))
    throw new Error(
      `Character ${str.charAt(
        index
      )} at position ${index} in ${str} is not a hex char`
    );

  return val;
};

export const isHexByteString = (
  str: string,
  expectedBytes?: number
): boolean => {
  let i = str.length > 1 && str[1] == "x" ? 2 : 0;
  if (
    str.length % 2 !== 0 ||
    (expectedBytes !== undefined && str.length - i !== 2 * expectedBytes)
  )
    return false;

  for (; i < str.length; ++i)
    if (Number.isNaN(tryAsciiHexCharToNumber(str, i))) return false;

  return true;
};

//TODO naming: arrayify (ethers), toBytes (solana)
export const hexByteStringToUint8Array = (str: string): Uint8Array => {
  if (str.length % 2 !== 0)
    throw new Error(`hex byte string has odd length: ${str}`);

  const prefixOffset = str.length > 2 && str[1] === "x" ? 2 : 0;
  const ret = new Uint8Array((str.length - prefixOffset) / 2);
  for (let i = prefixOffset; i < str.length; i += 2)
    ret[(i - prefixOffset) / 2] =
      asciiHexCharToNumber(str, i) * 16 + asciiHexCharToNumber(str, i + 1);

  return ret;
};

//TODO naming: hexlify (ethers)
export const uint8ArrayToHexByteString = (
  arr: Uint8Array,
  addPrefix = true
): string =>
  (addPrefix ? "0x" : "") +
  Array.from(arr)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
