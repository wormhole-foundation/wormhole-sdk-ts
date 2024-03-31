import { encoding, load, signSendWait, wormhole } from "@wormhole-foundation/sdk";
import { getSigner } from "./helpers/index.js";

(async function () {
  // EXAMPLE_CORE_BRIDGE
  const wh = await wormhole("Testnet", load("Solana"));

  const chain = wh.getChain("Solana");
  const { signer, address } = await getSigner(chain);

  // Get a reference to the core messaging bridge
  const coreBridge = await chain.getWormholeCore();

  // Generate transactions, sign and send them
  const publishTxs = coreBridge.publishMessage(
    // Address of sender (emitter in VAA)
    address.address,
    // Message to send (payload in VAA)
    encoding.bytes.encode("lol"),
    // Nonce (user defined, no requirement for a specific value, useful to provide a unique identifier for the message)
    0,
    // ConsistencyLevel (ie finality of the message, see wormhole docs for more)
    0,
  );
  // Send the transaction(s) to publish the message
  const txids = await signSendWait(chain, publishTxs, signer);

  // Take the last txid in case multiple were sent
  // the last one should be the one containing the relevant
  // event or log info
  const txid = txids[txids.length - 1];

  // Grab the wormhole message id from the transaction logs or storage
  const [whm] = await chain.parseTransaction(txid!.txid);

  // Or pull the full message content as an Unsigned VAA
  // const msgs = await coreBridge.parseMessages(txid!.txid);
  // console.log(msgs);

  // Wait for the vaa to be signed and available with a timeout
  const vaa = await wh.getVaa(whm!, "Uint8Array", 60_000);
  console.log(vaa);
  // Also possible to search by txid but it takes longer to show up
  // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  const verifyTxs = coreBridge.verifyMessage(address.address, vaa!);
  console.log(await signSendWait(chain, verifyTxs, signer));
  // EXAMPLE_CORE_BRIDGE

  // reposting the vaa should result in 0 transactions being issued
  // assuming you're reading your writes
  // await signSendWait(chain, coreBridge.verifyMessage(address.address, vaa!), signer);
})();
