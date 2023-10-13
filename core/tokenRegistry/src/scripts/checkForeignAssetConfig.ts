// patch out annoying logs
const info = console.info;
console.info = function (x: any, ...rest: any) {
  if (x !== "secp256k1 unavailable, reverting to browser version") {
    info(x, ...rest);
  }
};
const warn = console.warn;
console.warn = function (x: any, ...rest: any) {
  if (
    !x
      .toString()
      .startsWith(
        "Error: Error: RPC Validation Error: The response returned from RPC server does not match the TypeScript definition. This is likely because the SDK version is not compatible with the RPC server.",
      )
  ) {
    warn(x, ...rest);
  }
};

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

// warning: be careful optimizing the RPC calls in this script, you may 429 yourself
// slow and steady, or something like that
const checkEnvConfig = async (env: Network, tokensConfig: TokensConfig) => {
  const wh = new Wormhole(env, [EvmPlatform, SolanaPlatform]);

  const [numUpdates, suggestedUpdates] = await getSuggestedUpdates(
    wh,
    tokensConfig,
  );
  if ((numUpdates as number) > 0) {
    console.log(`
      ${numUpdates} updates available. To update, run:\n
      npm run updateForeignAssets`);
    console.log(JSON.stringify(suggestedUpdates, null, 4));
  } else {
    console.log("Up to date");
  }
};

(async () => {
  await checkEnvConfig("Testnet", TESTNET_TOKENS);
  await checkEnvConfig("Mainnet", MAINNET_TOKENS);
})();
