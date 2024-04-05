import { describe, expect, test } from "@jest/globals";
import { getCanonicalToken, getTokensBySymbol } from "./../src/constants/tokens/index.js";
import { Chain, TokenSymbol } from "./../src/index.js";

// prettier-ignore
// A table of chains and expected token addresses
const chainTokenTable: [Chain, TokenSymbol, string][] = [
    ["Ethereum", "ETH", "native"],
    ["Polygon", "MATIC", "native"],
    ["Ethereum", "USDC", "0x07865c6e87b9f70255377e024ace6630c1eaa37f"]
];

// prettier-ignore
// we may need to lookup the original asset address for a token
const canonicalChainTokenTable: [Chain, TokenSymbol, Chain, string][] = [
    // WETH bridged from Eth to arbitrum
  ["Arbitrum", "WETH", "Ethereum", "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"],
];

describe("Token Tests", function () {
  describe("Symbol to address", function () {
    test.each(chainTokenTable)("resolves properly", function (chain, symbol, addy) {
      const tokens = getTokensBySymbol("Testnet", chain, symbol);
      expect(tokens).toBeDefined();
      if (addy === "native") expect(tokens).toHaveLength(1);
      else expect(tokens?.length).toBeGreaterThan(0);

      expect(tokens![0]!.address).toEqual(addy);
    });
  });

  describe("Resolve canonical", function () {
    test.each(canonicalChainTokenTable)(
      "resolves properly",
      function (foreignChain, symbol, nativeChain, addy) {
        const canonical = getCanonicalToken("Testnet", foreignChain, symbol);
        expect(canonical).toBeDefined();
        expect(canonical!.chain).toEqual(nativeChain);
      },
    );
  });
});
