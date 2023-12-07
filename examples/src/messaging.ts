import { Wormhole, encoding, signSendWait } from "@wormhole-foundation/connect-sdk";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { getStuff } from "./helpers";
import { SolanaWormholeCore } from "@wormhole-foundation/connect-sdk-solana-core";
import "@wormhole-foundation/connect-sdk-solana-core";

(async function () {
  const wh = new Wormhole("Testnet", [SolanaPlatform]);

  const solChain = wh.getChain("Solana");
  const { signer, address } = await getStuff(solChain);

  const coreBridge = (await solChain.getWormholeCore()) as SolanaWormholeCore<"Testnet", "Solana">;
  const [txid] = await signSendWait(
    solChain,
    coreBridge.publishMessage(address.address, encoding.bytes.encode("lol"), 0, 0),
    signer,
  );
  const [whm] = await solChain.parseTransaction(txid!.txid);
  const vaa = await wh.getVaa(whm!, "Uint8Array");
  console.log(vaa);
  // can also do this but txid search takes longer to index
  // console.log(await wh.getVaaByTxHash(txid!.txid, "Uint8Array"));

  const postedTxs = await signSendWait(solChain, coreBridge.postVaa(address.address, vaa!), signer);
  console.log(postedTxs);

  // reposting the vaa should result in 0 transactions being issued
  // assuming you're reading your writes
  const rePostedTxs = await signSendWait(
    solChain,
    coreBridge.postVaa(address.address, vaa!),
    signer,
  );
  console.log(rePostedTxs);
})();
