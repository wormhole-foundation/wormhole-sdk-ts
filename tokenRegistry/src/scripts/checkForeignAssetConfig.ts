import * as fs from "fs";
import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getSuggestedUpdates } from "./foreignAssets";
import { TokensConfig } from "../types";
import { tokenFilePath } from "./utils";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

// warning: be careful optimizing the RPC calls in this script, you may 429 yourself
// slow and steady, or something like that
const checkEnvConfig = async (env: Network, tokensConfig: TokensConfig) => {
  const wh = new Wormhole(env, [EvmPlatform, SolanaPlatform]);

  const [numUpdates, suggestedUpdates] = await getSuggestedUpdates(wh, tokensConfig);
  if ((numUpdates as number) > 0) {
    console.log(`
      ${numUpdates} updates available. To update, run:\n
      npm run updateForeignAssets`);
    console.log(JSON.stringify(suggestedUpdates, null, 4));
  } else {
    console.log("Up to date");
  }
};

const testnetTokens = fs.readFileSync(tokenFilePath("Testnet"), "utf-8");
const TESTNET_TOKENS = JSON.parse(testnetTokens) as TokensConfig;
const mainnetTokens = fs.readFileSync(tokenFilePath("Mainnet"), "utf-8");
const MAINNET_TOKENS = JSON.parse(mainnetTokens) as TokensConfig;

(async () => {
  await checkEnvConfig("Testnet", TESTNET_TOKENS);
  await checkEnvConfig("Mainnet", MAINNET_TOKENS);
})();
