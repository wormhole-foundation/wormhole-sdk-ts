import { Wormhole, encoding, signSendWait } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { SuiPlatform } from "@wormhole-foundation/connect-sdk-sui";
import { AptosPlatform } from "@wormhole-foundation/connect-sdk-aptos";

// register the protocol
import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-solana-core";
import "@wormhole-foundation/connect-sdk-sui-core";
import "@wormhole-foundation/connect-sdk-aptos-core";
import { getStuff } from "./helpers";

(async function () {
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform, SuiPlatform, AptosPlatform]);

  const chain = wh.getChain("Aptos");

  // Get a reference to the core messaging bridge
  const coreBridge = await chain.getWormholeCore();

  // Generate transactions, sign and send them
  // const { signer, address } = await getStuff(chain);
  // const publishTxs = coreBridge.publishMessage(address.address, encoding.bytes.encode("lol"), 0, 0);
  // const txids = await signSendWait(chain, publishTxs, signer);

  // Take the last txid in case multiple were sent
  // the last one should be the one containing the relevant
  // event or log info
  //const txid = txids[txids.length - 1];

  const txid = {
    chain: "Aptos",
    txid: "0x2af3d60f7a45740adce4d78c8857a9d992c0c96472d8b5224717ff2975b7c1e7",
  };

  // Grab the wormhole message id from the transaction logs or storage
  const [whm] = await chain.parseTransaction(txid!.txid);
  console.log(whm);

  //const unsignedVaas = await coreBridge.parseMessages(txid!.txid);
  //console.log(unsignedVaas);

  // // Wait for the vaa with a timeout,
  // const vaa = await wh.getVaa(whm!, "Uint8Array", 60_000);
  // console.log(vaa);
  // // can also search by txid but it takes longer to show up
  // // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  // const verifyTxs = coreBridge.verifyMessage(address.address, vaa!);
  // console.log(await signSendWait(chain, verifyTxs, signer));

  // // reposting the vaa should result in 0 transactions being issued
  // // assuming you're reading your writes
  // // await signSendWait(chain, coreBridge.verifyMessage(address.address, vaa!), signer);
})();
