import { wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import { signSendWait } from "@wormhole-foundation/sdk";
import { getSigner } from "./helpers/index.js";

(async function () {
  const wh = await wormhole("Testnet", [evm, solana]);

  const snd = wh.getChain("Sepolia");
  const rcv = wh.getChain("Solana");

  const sender = await getSigner(snd);
  const receiver = await getSigner(rcv);

  const ntt = await snd.getNtt("0x1d30E78B7C7fbbcef87ae6e97B5389b2e470CA4a");
  const xferTxs = ntt.transfer(sender.address.address, 1n, receiver.address, false);
  const txids = await signSendWait(snd, xferTxs, sender.signer);
  console.log(txids);
})();
