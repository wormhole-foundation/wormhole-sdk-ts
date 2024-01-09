import * as fs from "fs";
import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { getSuggestedUpdates } from "./foreignAssets";
import { TokensConfig } from "../types";
import { mergeDeep, tokenFilePath } from "./utils";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

const testnetTokens = fs.readFileSync(tokenFilePath("Testnet"), "utf-8");
const TESTNET_TOKENS = JSON.parse(testnetTokens) as TokensConfig;
const mainnetTokens = fs.readFileSync(tokenFilePath("Mainnet"), "utf-8");
const MAINNET_TOKENS = JSON.parse(mainnetTokens) as TokensConfig;

// warning: be careful optimizing the RPC calls in this script, you may 429 yourself
// slow and steady, or something like that
const checkEnvConfig = async (env: Network, tokensConfig: TokensConfig) => {
  const wh = new Wormhole(env, [EvmPlatform, SolanaPlatform]);

  const data = await getSuggestedUpdates(wh, tokensConfig);
  const suggestedUpdates = data[1] as TokensConfig;
  const newConfig = mergeDeep(tokensConfig, suggestedUpdates);
  fs.writeFileSync(tokenFilePath(env), JSON.stringify(newConfig, null, 2));
};

(async () => {
  await checkEnvConfig("Testnet", TESTNET_TOKENS);
  await checkEnvConfig("Mainnet", MAINNET_TOKENS);
})();
