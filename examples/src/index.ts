import { CONFIG, Wormhole, amount, api, signSendWait } from "@wormhole-foundation/sdk";

import { algorand } from "@wormhole-foundation/sdk/algorand";
import { cosmwasm } from "@wormhole-foundation/sdk/cosmwasm";
import { evm } from "@wormhole-foundation/sdk/evm";
import { solana } from "@wormhole-foundation/sdk/solana";
import { sui } from "@wormhole-foundation/sdk/sui";

import { getStuff } from "./helpers";

(async function () {
  // Setup
  const wh = new Wormhole("Mainnet", [
    evm.Platform,
    solana.Platform,
    sui.Platform,
    algorand.Platform,
    cosmwasm.Platform,
  ]);

  const snd = wh.getChain("Sui");
  const rcv = wh.getChain("Algorand");

  const sender = await getStuff(snd);
  const receiver = await getStuff(rcv);

  // Get a Token Bridge contract client on the source
  const sndTb = await snd.getTokenBridge();

  // Create a transaction stream for transfers
  const transfer = sndTb.transfer(
    sender.address.address,
    receiver.address,
    "native",
    amount.units(amount.parse("0.1", snd.config.nativeTokenDecimals)),
  );

  // Sign and send the transaction
  const txids = await signSendWait(snd, transfer, sender.signer);
  console.log("Sent: ", txids);

  // Get the wormhole message id from the transaction
  const [whm] = await snd.parseTransaction(txids[txids.length - 1]!.txid);
  console.log("Wormhole Messages: ", whm);

  // Get the VAA from the wormhole message id
  const vaa = await api.getVaaWithRetry(
    CONFIG["Testnet"].api,
    whm!,
    "TokenBridge:Transfer",
    60_000,
  );

  // Now get the token bridge on the redeem side
  const rcvTb = await rcv.getTokenBridge();

  // Create a transaction stream for redeeming
  const redeem = rcvTb.redeem(receiver.address.address, vaa!);

  // Sign and send the transaction
  const rcvTxids = await signSendWait(rcv, redeem, receiver.signer);
  console.log("Sent: ", rcvTxids);

  // Now get the token bridge on the redeem side
  const finished = await rcvTb.isTransferCompleted(vaa!);
  console.log("Transfer completed: ", finished);
})();
