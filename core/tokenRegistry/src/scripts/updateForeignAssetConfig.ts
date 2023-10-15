import * as fs from "fs";
import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { getSuggestedUpdates } from "../foreignAssets";
import { TokensConfig } from "../types";

const testnetTokens = fs.readFileSync("src/tokens/testnetTokens.json", "utf-8");
const TESTNET_TOKENS = JSON.parse(testnetTokens) as TokensConfig;
const mainnetTokens = fs.readFileSync("src/tokens/mainnetTokens.json", "utf-8");
const MAINNET_TOKENS = JSON.parse(mainnetTokens) as TokensConfig;

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target: any, ...sources: any) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

// warning: be careful optimizing the RPC calls in this script, you may 429 yourself
// slow and steady, or something like that
const checkEnvConfig = async (env: Network, tokensConfig: TokensConfig) => {
  const wh = new Wormhole(env, [EvmPlatform, SolanaPlatform]);

  const data = await getSuggestedUpdates(wh, tokensConfig);
  const suggestedUpdates = data[1] as TokensConfig;
  const newConfig = mergeDeep(tokensConfig, suggestedUpdates);
  const filePath =
    env === "Mainnet"
      ? "src/tokens/mainnetTokens.json"
      : "src/tokens/testnetTokens.json";
  fs.writeFileSync(filePath, JSON.stringify(newConfig, null, 2));
};

(async () => {
  await checkEnvConfig("Testnet", TESTNET_TOKENS);
  await checkEnvConfig("Mainnet", MAINNET_TOKENS);
})();
