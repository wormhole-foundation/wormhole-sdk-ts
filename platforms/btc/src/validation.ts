import { base58, bech32, bech32m } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";

const BASE58_VERSION_BYTES = new Set<number>([
  0x00, // P2PKH mainnet
  0x05, // P2SH  mainnet
  0x6f, // P2PKH testnet / signet / regtest
  0xc4, // P2SH  testnet / signet / regtest
]);

const SEGWIT_HRPS = new Set<string>([
  "bc", // mainnet
  "tb", // testnet / signet
  "bcrt", // regtest
]);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isValidBase58CheckAddress(address: string): boolean {
  let decoded: Uint8Array;
  try {
    decoded = base58.decode(address);
  } catch {
    return false;
  }

  if (decoded.length !== 25) return false;

  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21, 25);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  if (!bytesEqual(checksum, expected)) return false;

  return BASE58_VERSION_BYTES.has(payload[0]!);
}

function isValidSegwitAddress(address: string): boolean {
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    return false;
  }

  const normalized = address.toLowerCase();

  let prefix: string;
  let words: number[];
  let usedBech32m: boolean;

  const v0 = bech32.decodeUnsafe(normalized);
  if (v0) {
    prefix = v0.prefix;
    words = v0.words;
    usedBech32m = false;
  } else {
    const v1 = bech32m.decodeUnsafe(normalized);
    if (!v1) return false;
    prefix = v1.prefix;
    words = v1.words;
    usedBech32m = true;
  }

  if (!SEGWIT_HRPS.has(prefix)) return false;
  if (words.length === 0) return false;

  const witnessVersion = words[0]!;
  if (witnessVersion < 0 || witnessVersion > 16) return false;

  // BIP173: witness v0 uses bech32; BIP350: v1+ uses bech32m.
  if (witnessVersion === 0 && usedBech32m) return false;
  if (witnessVersion !== 0 && !usedBech32m) return false;

  let program: Uint8Array;
  try {
    program = bech32.fromWords(words.slice(1));
  } catch {
    return false;
  }

  // BIP141 program length bounds.
  if (program.length < 2 || program.length > 40) return false;
  // BIP141: v0 programs must be exactly 20 (P2WPKH) or 32 (P2WSH) bytes.
  if (witnessVersion === 0 && program.length !== 20 && program.length !== 32) {
    return false;
  }

  return true;
}

export function isValidBtcAddress(address: string): boolean {
  if (typeof address !== "string") return false;
  const trimmed = address.trim();
  if (trimmed.length === 0) return false;

  return isValidBase58CheckAddress(trimmed) || isValidSegwitAddress(trimmed);
}
