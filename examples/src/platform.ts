import { CONFIG, ProtocolImplementation, WormholeCore } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";

(async function () {
  const ep = new (await evm()).Platform("Mainnet", CONFIG["Mainnet"].chains);
  const conn = await ep.getRpc("Ethereum");
  const core: WormholeCore<"Mainnet", "Ethereum"> = await ep.getProtocol("WormholeCore", conn);
  console.log(core);
})();
