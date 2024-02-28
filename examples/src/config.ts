import { Wormhole } from "@wormhole-foundation/sdk";
import { solana } from "@wormhole-foundation/sdk/solana";

(async function () {
  // Pass a partial WormholeConfig object to override specific
  // fields in the default config
  const wh = new Wormhole("Testnet", [solana.Platform], {
    chains: {
      Solana: {
        contracts: {
          coreBridge: "11111111111111111111111111111",
        },
        rpc: "https://api.devnet.solana.com",
      },
    },
  });

  console.log(wh.config.chains.Solana);
})();
