import { Wormhole, encoding, signSendWait } from "@wormhole-foundation/connect-sdk";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { getStuff } from "./helpers";

// register the protocol
import "@wormhole-foundation/connect-sdk-solana-core";

(async function () {
  const wh = new Wormhole("Testnet", [SolanaPlatform]);

  const chain = wh.getChain("Solana");
  const { signer, address } = await getStuff(chain);

  // Get a reference to the core messaging bridge
  const coreBridge = await chain.getWormholeCore();

  // Generate transactions, sign and send them
  const publishTxs = coreBridge.publishMessage(address.address, encoding.bytes.encode("lol"), 0, 0);
  const [txid] = await signSendWait(chain, publishTxs, signer);

  // Grab the wormhole message from the transaction logs or storage
  const [whm] = await chain.parseTransaction(txid!.txid);

  // Wait for the vaa with a timeout,
  const vaa = await wh.getVaa(whm!, "Uint8Array", 60_000);
  console.log(vaa);
  // can also search by txid but it takes longer to show up
  // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  const verifyTxs = coreBridge.verifyMessage(address.address, vaa!);
  await signSendWait(chain, verifyTxs, signer);

  // reposting the vaa should result in 0 transactions being issued
  // assuming you're reading your writes
  // await signSendWait(chain, coreBridge.verifyMessage(address.address, vaa!), signer);
})();
