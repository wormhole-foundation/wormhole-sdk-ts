import { encoding, signSendWait, wormhole } from "@wormhole-foundation/sdk";
import { getSigner } from "./helpers/index.js";
import solana from "@wormhole-foundation/sdk/solana";
import evm from "@wormhole-foundation/sdk/evm";

(async function () {
  // EXAMPLE_CORE_BRIDGE
  const wh = await wormhole("Testnet", [solana, evm]);

  const chain = wh.getChain("Avalanche");
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
  // console.log(await coreBridge.parseMessages(txid!.txid));

  // Wait for the vaa to be signed and available with a timeout
  const vaa = await wh.getVaa(whm!, "Uint8Array", 60_000);
  console.log(vaa);

  // Also possible to search by txid but it takes longer to show up
  // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  // Note: calling verifyMessage manually is typically not a useful thing to do
  // as the VAA is typically submitted to the counterpart contract for
  // a given protocol and the counterpart contract will verify the VAA
  // this is simply for demo purposes
  const verifyTxs = coreBridge.verifyMessage(address.address, vaa!);
  console.log(await signSendWait(chain, verifyTxs, signer));
  // EXAMPLE_CORE_BRIDGE
})();
