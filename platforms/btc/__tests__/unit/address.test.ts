import { BtcAddress } from "../../src/address.js";
import { isValidBtcAddress } from "../../src/validation.js";

const VALID_ADDRESSES: ReadonlyArray<readonly [string, string]> = [
  // Base58Check P2PKH
  ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "P2PKH mainnet (Genesis)"],
  ["1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "P2PKH mainnet"],
  ["mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", "P2PKH testnet"],

  // Base58Check P2SH
  ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "P2SH mainnet"],
  ["3P14159f73E4gFr7JterCCQh9QjiTjiZrG", "P2SH mainnet (BIP16)"],
  ["2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br", "P2SH testnet"],

  // bech32 segwit v0 (BIP173 test vectors)
  ["bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", "P2WPKH mainnet (BIP173)"],
  [
    "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4",
    "P2WPKH mainnet uppercase (BIP173)",
  ],
  [
    "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
    "P2WSH mainnet (BIP173)",
  ],
  [
    "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
    "P2WSH testnet (BIP173)",
  ],
  ["tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", "P2WPKH testnet"],

  // bech32m segwit v1+ (BIP350 / generated)
  [
    "bc1pqqqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qarc0sg5tmnz",
    "P2TR mainnet",
  ],
  [
    "tb1pqqqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qarc0slua5fd",
    "P2TR testnet",
  ],
  [
    "bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y",
    "BIP350 v1 mainnet 40-byte program",
  ],
  ["BC1SW50QGDZ25J", "BIP350 v16 mainnet (uppercase)"],
  ["bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs", "BIP350 v2 mainnet"],
];

const INVALID_ADDRESSES: ReadonlyArray<readonly [string, string]> = [
  ["", "empty string"],
  ["   ", "whitespace only"],
  ["notanaddress", "random non-bitcoin string"],
  ["0x1234abcd", "Ethereum-looking string"],

  // Base58Check checksum failures (single character mutated)
  ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb", "P2PKH last-char mutation"],
  ["1A1zPqeP5QGefi2DMPTfTL5SLmv7DivfNa", "P2PKH inner-char mutation"],
  ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLz", "P2SH last-char mutation"],
  ["3J98tqWpEZ73CNmQviecrnyiWrnqRhWNLy", "P2SH inner-char mutation"],

  // Base58Check with disallowed version byte (Litecoin P2PKH starts with L, version 0x30)
  ["LM2WMpR1Rp6j3Sa59cMXMs1SPzj9eXpGc1", "Litecoin P2PKH (wrong version byte)"],

  // Bech32 checksum failures (single character mutated)
  [
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5",
    "P2WPKH last-char mutation",
  ],
  [
    "bc1qw508q6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    "P2WPKH inner-char mutation",
  ],
  [
    "bc1pqqqsqqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qarc0sg5tmnz",
    "P2TR mutation (bech32m checksum failure)",
  ],

  // Encoding-version mismatches (BIP350)
  [
    "bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqs9wcxj",
    "v0 program encoded with bech32m (must be bech32)",
  ],
  [
    "bc1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq5us4ke",
    "v1 program encoded with bech32 (must be bech32m)",
  ],

  // Invalid v0 program length (21 bytes — must be exactly 20 or 32)
  [
    "bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqj9pecr",
    "v0 with 21-byte program",
  ],

  // Mixed case (BIP173 forbids)
  [
    "Bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    "mixed-case bech32",
  ],

  // Wrong HRP (Litecoin)
  [
    "ltc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqp9ysmq",
    "Litecoin bech32 (wrong HRP)",
  ],
];

describe("BTC address validation", () => {
  describe("isValidBtcAddress", () => {
    for (const [address, label] of VALID_ADDRESSES) {
      test(`accepts ${label} (${address})`, () => {
        expect(isValidBtcAddress(address)).toBe(true);
      });
    }

    for (const [address, label] of INVALID_ADDRESSES) {
      test(`rejects ${label} (${JSON.stringify(address)})`, () => {
        expect(isValidBtcAddress(address)).toBe(false);
      });
    }

    test("rejects non-string inputs", () => {
      expect(isValidBtcAddress(undefined as unknown as string)).toBe(false);
      expect(isValidBtcAddress(null as unknown as string)).toBe(false);
      expect(isValidBtcAddress(123 as unknown as string)).toBe(false);
    });
  });

  describe("BtcAddress constructor", () => {
    for (const [address, label] of VALID_ADDRESSES) {
      test(`accepts ${label} (${address})`, () => {
        const btc = new BtcAddress(address);
        expect(btc.toString()).toBe(address.trim());
      });
    }

    for (const [address, label] of INVALID_ADDRESSES) {
      test(`rejects ${label} (${JSON.stringify(address)})`, () => {
        expect(() => new BtcAddress(address)).toThrow(/Invalid BTC address/);
      });
    }

    test("trims surrounding whitespace before validating", () => {
      const padded = `   1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa   `;
      const btc = new BtcAddress(padded);
      expect(btc.toString()).toBe("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
    });

    test("accepts a Uint8Array of a valid address", () => {
      // Pick something that fits in 32 bytes (Genesis P2PKH is 34 chars, P2SH is 34).
      const addr = "BC1SW50QGDZ25J";
      const bytes = new Uint8Array(32);
      bytes.set(new TextEncoder().encode(addr));
      const btc = new BtcAddress(bytes);
      expect(btc.toString()).toBe(addr);
    });

    test("rejects a Uint8Array of an invalid address", () => {
      const bytes = new Uint8Array(32);
      bytes.set(new TextEncoder().encode("notanaddress"));
      expect(() => new BtcAddress(bytes)).toThrow(/Invalid BTC address/);
    });

    test("round-trips an existing BtcAddress instance without re-validation surprises", () => {
      const original = new BtcAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy");
      const copy = new BtcAddress(original);
      expect(copy.toString()).toBe(original.toString());
    });
  });
});
