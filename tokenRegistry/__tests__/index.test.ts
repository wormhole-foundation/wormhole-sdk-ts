import * as fs from "fs";
import { TokensConfig } from "../src/types";
import { Network } from "@wormhole-foundation/connect-sdk";

const testnetTokens = fs.readFileSync("src/tokens/TestnetTokens.json", "utf-8");
const TESTNET_TOKENS = JSON.parse(testnetTokens) as TokensConfig;
const mainnetTokens = fs.readFileSync("src/tokens/MainnetTokens.json", "utf-8");
const MAINNET_TOKENS = JSON.parse(mainnetTokens) as TokensConfig;

const getTokens = (network: Network) => {
  return network === "Mainnet" ? MAINNET_TOKENS : TESTNET_TOKENS;
};

describe("token config format", () => {
  const networks: Network[] = ["Mainnet", "Testnet"];
  networks.forEach((network) => {
    const tokens = getTokens(network);
    describe(`All ${network} token details are set`, () => {
      for (const [chain, chainTokens] of Object.entries(tokens)) {
        for (const [address, tokenConfig] of Object.entries(chainTokens)) {
          test(`${chain} ${address} details are set`, () => {
            expect(tokenConfig.name).toBeTruthy();
            expect(tokenConfig.symbol).toBeTruthy();
            expect(tokenConfig.decimals).toBeTruthy();
            expect(tokenConfig.nativeChain).toBe(chain);
          });
        }
      }
    });
  });
});
