import { Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

// register the protocol
import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-solana-core";

(async function () {
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  const chain = wh.getChain("Sepolia");
  //const { signer, address } = await getStuff(chain);

  // Get a reference to the core messaging bridge
  const coreBridge = await chain.getWormholeCore();

  // Generate transactions, sign and send them
  // const publishTxs = coreBridge.publishMessage(address.address, encoding.bytes.encode("lol"), 0, 0);
  // const txids = await signSendWait(chain, publishTxs, signer);

  // Take the last txid in case multiple were sent
  // the last one should be the one containing the relevant
  // event or log info
  // const txid = txids[txids.length - 1];

  const txid = "0xf1ae0a1c26a73d1a8ec7366b14c3b45439eb5322d34ac93964479acad61660f4";

  const [msg] = await coreBridge.parseMessages("Uint8Array", txid);
  console.log(msg);

  // // Grab the wormhole message from the transaction logs or storage
  // const [whm] = await chain.parseTransaction(txid!.txid);

  // // // Wait for the vaa with a timeout,
  // const vaa = await wh.getVaa(whm!, "Uint8Array", 60_000);
  // console.log(vaa);
  // // can also search by txid but it takes longer to show up
  // // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  // const verifyTxs = coreBridge.verifyMessage(address.address, vaa!);
  // console.log(await signSendWait(chain, verifyTxs, signer));

  // reposting the vaa should result in 0 transactions being issued
  // assuming you're reading your writes
  // await signSendWait(chain, coreBridge.verifyMessage(address.address, vaa!), signer);
})();
