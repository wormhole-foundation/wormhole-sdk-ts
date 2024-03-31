// EXAMPLE_IMPORTS
import { load, wormhole } from "@wormhole-foundation/sdk";
// EXAMPLE_IMPORTS

import { amount, signSendWait } from "@wormhole-foundation/sdk";
import { getSigner } from "./helpers/index.js";

(async function () {
  // EXAMPLE_WORMHOLE_INIT
  const wh = await wormhole("Testnet", load());
  // EXAMPLE_WORMHOLE_INIT

  // EXAMPLE_WORMHOLE_CHAIN
  // Grab a ChainContext object from our configured Wormhole instance
  const ctx = wh.getChain("Solana");
  // EXAMPLE_WORMHOLE_CHAIN

  const rcv = wh.getChain("Algorand");

  const sender = await getSigner(ctx);
  const receiver = await getSigner(rcv);

  // Get a Token Bridge contract client on the source
  const sndTb = await ctx.getTokenBridge();

  // Create a transaction stream for transfers
  const transfer = sndTb.transfer(
    sender.address.address,
    receiver.address,
    "native",
    amount.units(amount.parse("0.1", ctx.config.nativeTokenDecimals)),
  );

  // Sign and send the transaction
  const txids = await signSendWait(ctx, transfer, sender.signer);
  console.log("Sent: ", txids);

  // Get the wormhole message id from the transaction
  const [whm] = await ctx.parseTransaction(txids[txids.length - 1]!.txid);
  console.log("Wormhole Messages: ", whm);

  // EXAMPLE_WORMHOLE_VAA
  // Get the VAA from the wormhole message id
  const vaa = await wh.getVaa(
    // Wormhole Message ID
    whm!,
    // Protocol:Payload name to use for decoding the VAA payload
    "TokenBridge:Transfer",
    // Timeout in milliseconds, depending on the chain and network, the VAA may take some time to be available
    60_000,
  );
  // EXAMPLE_WORMHOLE_VAA

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
