import { Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { Chain, Network } from "@wormhole-foundation/sdk-base";
import * as fs from "fs";
import { TokensConfig } from "../types";
import { automaticTokensFilePath } from "./utils";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

const checkEnvConfig = async (env: Network, tokensConfig: TokensConfig) => {
  const wh = new Wormhole(env, [EvmPlatform, SolanaPlatform]);

  // Use Ethereum to get the primary list we intend to look up
  const src: Chain = "Ethereum";
  const srcCtx = wh.getChain(src);
  const tb = await srcCtx.getTokenBridge();
  const atb = await srcCtx.getAutomaticTokenBridge();
  const tokens = await atb.getRegisteredTokens();

  // Accepted tokens may be wrapped, find the original
  // token so we can look them up on all the destination
  // chains
  const originalTokens = await Promise.all(
    tokens.map(async (token) => {
      try {
        const orig = await tb.getOriginalAsset(token);
        return orig;
      } catch {}
      return { chain: src, address: token };
    }),
  );

  // List of chains where automatic token bridge is deployed
  const atbChains = Object.entries(wh.config.chains)
    .map(([name, config]) => {
      return [name, config.contracts.tokenBridgeRelayer] as [Chain, string | undefined];
    })
    .filter(([_, maybe]) => !!maybe)
    .map(([name, _]) => name);

  const results = await Promise.all(
    atbChains.map(async (dst) => {
      try {
        const dstChain = wh.getChain(dst);
        const dstTb = await dstChain.getTokenBridge();
        const dstNativeTokens = originalTokens.map(async (orig) => {
          if (orig.chain === dst) return { chain: orig.chain, address: orig.address.toNative(dst) };
          try {
            const address = await dstTb.getWrappedAsset(orig);
            return { chain: dst, address: address.toNative() };
          } catch {}
        });

        const resolved = (await Promise.all(dstNativeTokens)).filter((t) => !!t);
        return { chain: dst, tokens: resolved };
      } catch {}

      return { chain: dst, tokens: [] };
    }),
  );

  const newConfig = Object.fromEntries(
    results.map((result) => {
      return [result.chain, result.tokens.map((t) => t?.address.unwrap().toString())];
    }),
  );

  fs.writeFileSync(automaticTokensFilePath(env), JSON.stringify(newConfig, null, 2));
};

(async () => {
  const nets: Network[] = ["Mainnet", "Testnet"];
  for (const network of nets) {
    const tokens = fs.readFileSync(automaticTokensFilePath(network), "utf-8");
    const TOKENS = JSON.parse(tokens) as TokensConfig;
    await checkEnvConfig(network, TOKENS);
  }
})();
