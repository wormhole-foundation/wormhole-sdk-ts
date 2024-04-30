import { loadProtocols } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";

(async function () {
  await loadProtocols(evm);

  const platform = new evm.Platform("Testnet");
  const chain = platform.getChain("Sepolia");
  const core = await chain.getWormholeCore();
  const [msg] = await core.parseMessages(
    "0xb13ae6de4aadbc33b031c572acd724e9793e2def7437c9dba9e4b7bb4f544258",
  );
  console.log(msg);
})();
