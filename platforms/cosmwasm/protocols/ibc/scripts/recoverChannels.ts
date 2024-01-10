import { Chain, Wormhole, platformToChains } from "@wormhole-foundation/connect-sdk";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";

import "@wormhole-foundation/connect-sdk-cosmwasm-ibc";

(async function () {
  const wh = new Wormhole("Mainnet", [CosmwasmPlatform]);
  const wc = wh.getChain("Wormchain");
  const rpc = await wc.getRpc();

  const gwIbc = await wc.getIbcBridge();

  async function maybeGetChannels(chain: Chain): Promise<[string, string] | null> {
    try {
      const tc = await gwIbc.fetchTransferChannel(chain);
      if (!tc) {
        console.log("No transfer channel for: ", chain);
        return null;
      }

      const cpc = await CosmwasmPlatform.getCounterpartyChannel(tc, rpc);
      if (!cpc) {
        console.log("No counterparty channel for: ", chain);
        return null;
      }
      return [tc, cpc];
    } catch (e) {
      //console.error(e);
    }
    return null;
  }

  const cwchains = platformToChains("Cosmwasm");

  for (const ch of cwchains) {
    const channels = await maybeGetChannels(ch as Chain);
    if (!channels) continue;
    const [tc, rc] = channels;
    console.log(`${ch}=>(${tc} : ${rc})`);
  }
})();
