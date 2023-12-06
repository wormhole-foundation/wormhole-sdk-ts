import { Wormhole, encoding, signSendWait } from "@wormhole-foundation/connect-sdk";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import "@wormhole-foundation/connect-sdk-solana-core";
import { getStuff } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [SolanaPlatform]);

  // Grab chain Contexts
  const solChain = wh.getChain("Solana");
  const { signer, address } = await getStuff(solChain);

  const coreBridge = await solChain.getWormholeCore();
  const [txid] = await signSendWait(
    solChain,
    coreBridge.publishMessage(address.address, encoding.bytes.encode("lol")),
    signer,
  );

  const [whm] = await solChain.parseTransaction(txid!.txid);
  console.log(await wh.getVaa(whm!, "Uint8Array"));
})();
