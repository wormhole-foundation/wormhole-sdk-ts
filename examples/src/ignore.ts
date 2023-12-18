import { Chain, TokenTransfer, Wormhole } from "@wormhole-foundation/connect-sdk";

// Import the platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

// Register the protocols
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Mainnet", [EvmPlatform, SolanaPlatform]);

  const src: Chain = "Ethereum";
  const dst: Chain = "Solana";

  const srcCtx = wh.getChain(src);
  const srcAtb = await srcCtx.getAutomaticTokenBridge();

  const dstCtx = wh.getChain(dst);
  const dstAtb = await dstCtx.getAutomaticTokenBridge();

  // Get the registered tokens from the source automatic token bridge
  const srcRegisteredTokens = await srcAtb.getRegisteredTokens();

  const results = await Promise.all(
    srcRegisteredTokens.map(async (token) => {
      const _token =
        token === "native"
          ? token
          : {
              chain: srcCtx.chain,
              address: token,
            };
      const dstToken = await TokenTransfer.lookupDestinationToken(srcCtx, dstCtx, _token);

      try {
        if (await dstAtb.isRegisteredToken(dstToken.address))
          return dstToken.address.unwrap().toString();
      } catch (e) {
        console.error(e);
      }
      return "";
    }),
  );

  for (const result of results) {
    console.log(result);
  }
})();
