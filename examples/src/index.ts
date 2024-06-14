// EXAMPLE_IMPORTS
import { wormhole } from "@wormhole-foundation/sdk";
// EXAMPLE_IMPORTS

import { Wormhole, amount, signSendWait } from "@wormhole-foundation/sdk";
import algorand from "@wormhole-foundation/sdk/algorand";
import aptos from "@wormhole-foundation/sdk/aptos";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import sui from "@wormhole-foundation/sdk/sui";
import { getSigner } from "./helpers/index.js";

(async function () {
  // EXAMPLE_WORMHOLE_INIT
  const wh = await wormhole("Testnet", [evm, solana, aptos, algorand, cosmwasm, sui]);
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

  // Send the native token of the source chain
  const tokenId = Wormhole.tokenId(ctx.chain, "native");

  // bigint amount using `amount` module
  const amt = amount.units(amount.parse("0.1", ctx.config.nativeTokenDecimals));

  // NOTE: If the recipient chain is Solana the ATA _must_ be the recipient address
  // using a standard wallet account address will result in a failed transfer
  // and loss of funds

  // Higher level objects like TokenTransfer are available and provide things like destination overrides
  // in the case that the destination has some special rules the source chain must follow for
  // successful redemption on the destination chain.

  // Some static helpers are available for more direct control
  // const withOverrides = await TokenTransfer.destinationOverrides(ctx, rcv, {
  //   token: tokenId,
  //   amount: amt,
  //   from: sender.address,
  //   to: receiver.address,
  // });
  // console.log(withOverrides);

  // Create a transaction stream for transfers
  const transfer = sndTb.transfer(sender.address.address, receiver.address, tokenId.address, amt);

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

  // Now check if the transfer is completed according to
  // the destination token bridge
  const finished = await rcvTb.isTransferCompleted(vaa!);
  console.log("Transfer completed: ", finished);
})();
