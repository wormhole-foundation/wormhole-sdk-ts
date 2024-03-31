import { load, wormhole } from "@wormhole-foundation/sdk";
(async function () {
  // EXAMPLE_CONFIG_OVERRIDE
  // Pass a partial WormholeConfig object to override specific
  // fields in the default config
  const wh = await wormhole("Testnet", load("Solana"), {
    chains: {
      Solana: {
        contracts: {
          coreBridge: "11111111111111111111111111111",
        },
        rpc: "https://api.devnet.solana.com",
      },
    },
  });
  // EXAMPLE_CONFIG_OVERRIDE
  console.log(wh.config.chains.Solana);
})();
