import { Wormhole, encoding, signSendWait } from "@wormhole-foundation/connect-sdk";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import "@wormhole-foundation/connect-sdk-solana-core";
import { getStuff } from "./helpers";
import { SolanaWormholeCore } from "@wormhole-foundation/connect-sdk-solana-core";
import { Connection } from "@solana/web3.js";

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

  const rpc = (await solChain.getRpc()) as Connection;
  const { blockhash } = await rpc.getRecentBlockhash();

  const postedTxs = await signSendWait(
    solChain,
    coreBridge.postVaa(address.address, vaa!, blockhash),
    signer,
  );
  console.log(postedTxs);
})();
