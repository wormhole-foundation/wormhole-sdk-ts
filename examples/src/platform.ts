import { CONFIG, PlatformToChains, WormholeCore } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";

(async function () {
  const ep = new (await evm()).Platform("Mainnet", CONFIG["Mainnet"].chains);
  const conn = await ep.getRpc("Ethereum");
  const core: WormholeCore<"Mainnet", PlatformToChains<"Evm">> = await ep.getProtocol(
    "WormholeCore",
    conn,
  );
  console.log(core);

  const chain = ep.getChain("Ethereum");
  const chainCore: WormholeCore<"Mainnet", "Ethereum"> = await chain.getProtocol("WormholeCore");
  console.log(chainCore);
})();
