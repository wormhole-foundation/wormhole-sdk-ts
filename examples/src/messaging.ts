import { Wormhole, serialize, deserialize } from "@wormhole-foundation/connect-sdk";
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

  const txid = "0x80545f7bfc7c97d8125b074b07831681f27cfb89b7adb41b11cb6a5bb2ac79fc";

  const msgs = await coreBridge.parseMessages(txid);
  const parsedMsgs = msgs.map((msg) => {
    const e = msg.emitterAddress.toString();
    if (e === "0x000000000000000000000000db5492265f6038831e89f495670ff909ade94bd9") {
      // token bridge
      return deserialize("TokenBridge:TransferWithPayload", serialize(msg));
    } else if (e === "0x0000000000000000000000007b1bd7a6b4e61c2a123ac6bc2cbfc614437d0470") {
      // relayer
      const v = deserialize("Relayer:DeliveryInstruction", serialize(msg));
      console.log(v.payload.messageKeys);
      return v;
    }
    return msg;
  });

  console.log(parsedMsgs);

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
