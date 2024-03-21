import { deserialize, finality, serialize, signSendWait, wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import { getSigner } from "./helpers/index.js";
import { send } from "process";

(async function () {
  const wh = await wormhole("Testnet", [evm, solana]);

  const snd = wh.getChain("Sepolia");
  const rcv = wh.getChain("Solana");

  const sender = await getSigner(snd);
  const receiver = await getSigner(rcv);

  // Prepare to send the transfer
  const ntt = await snd.getNtt("0x1d30E78B7C7fbbcef87ae6e97B5389b2e470CA4a");
  const xferTxs = ntt.transfer(sender.address.address, BigInt(1e10), receiver.address, false);
  // const txids = await signSendWait(snd, xferTxs, sender.signer);
  // console.log("Sent transfer with txids: ", txids);

  const core = await snd.getWormholeCore();
  const vaa = (
    await core.parseMessages("0xa1df47f86f85557433e2ea69e40e72da6662b5166bc4abc7731d6dbfca98a56b")
  )[0]!;

  const unsignedNttVaa = deserialize("Ntt:WormholeTransfer", serialize(vaa));
  console.log("Wormhole message parsed from logs: ", unsignedNttVaa.payload);

  const waitBlocks = finality.consistencyLevelToBlock(snd.chain, vaa.consistencyLevel);
  const waitTime = snd.config.blockTime * Number(waitBlocks);

  console.log("Getting signed vaa from the sender, appx wait time: ", waitTime / 1000, "s");
  const signedNttVaa = await wh.getVaa(
    { chain: vaa.emitterChain, emitter: vaa.emitterAddress, sequence: vaa.sequence },
    "Ntt:WormholeTransfer",
    waitTime * 1.2,
  );
  if (!signedNttVaa) {
    console.error("Shucks, the VAA was not signed in time. Try again in a bit");
    return;
  }

  // const dstNtt = await src.getNtt("0x1d30E78B7C7fbbcef87ae6e97B5389b2e470CA4a");
  // const redeemTxs = await ntt.redeem([signedNttVaa]);
  // const redeemTxIds = await signSendWait(snd, redeemTxs, sender.signer);
})();
