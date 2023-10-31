import {
  CONFIG,
  api,
  normalizeAmount,
  signSendWait,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";

import * as evmTb from "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import * as evmCore from "@wormhole-foundation/connect-sdk-evm-core";

import { getStuff } from "./helpers";

(async function () {
  evmTb.registerProtocols();
  evmCore.registerProtocols();
  // Setup
  const snd = EvmPlatform.getChain("Avalanche");
  const rcv = EvmPlatform.getChain("Ethereum");

  // get signers from local config
  const sender = await getStuff(snd);
  const receiver = await getStuff(rcv);

  // Get a Token Bridge contract client on the source
  const sndTb = await snd.getTokenBridge();

  // Create a transaction stream for transfers
  const transfer = sndTb.transfer(
    sender.address.address,
    receiver.address,
    "native",
    normalizeAmount("0.1", snd.config.nativeTokenDecimals),
  );

  // Sign and send the transaction
  const txids = await signSendWait(snd, transfer, sender.signer);
  console.log("Sent: ", txids);

  // Get the wormhole message id from the transaction
  const [whm] = await snd.parseTransaction(txids[txids.length - 1].txid);
  console.log("Wormhole Messages: ", whm);

  // Get the VAA from the wormhole message id
  const vaa = await api.getVaaWithRetry(
    CONFIG["Testnet"].api,
    whm,
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
