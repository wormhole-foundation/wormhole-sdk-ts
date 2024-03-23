import { ChainContext, Network, signSendWait, tokens, wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import { getSigner } from "./helpers/index.js";

(async function () {
  const wh = await wormhole("Testnet", [evm, solana]);

  const snd = wh.getChain("Solana");
  const rcv = wh.getChain("Sepolia");

  // An NTT Token has specific addresses on each chain and in config they provide the
  // Manager and Transceiver addresses
  const { srcToken, dstToken } = getTokenAddresses(snd, rcv, "TEST_NTT");

  // Get the signers for the chains
  const sender = await getSigner(snd);
  const receiver = await getSigner(rcv);

  // Prepare to send the transfer
  const ntt = await snd.getNtt(srcToken);
  const xferTxs = ntt.transfer(sender.address.address, BigInt(1e10), receiver.address, false);
  const txids = await signSendWait(snd, xferTxs, sender.signer);
  console.log("Sent transfer with txids: ", txids);

  // Collect the Attestations
  const signedNttVaa = await wh.getVaa(txids.pop()!.txid, "Ntt:WormholeTransfer", 15 * 60 * 1000);
  if (!signedNttVaa) throw "Shucks, the VAA was not signed in time. Try again in a bit";

  // Pass attestations to redeem transfer
  const dstNtt = await rcv.getNtt(dstToken);
  const redeemTxs = dstNtt.redeem([signedNttVaa], receiver.address.address);
  console.log("Sending redeem: ", await signSendWait(rcv, redeemTxs, receiver.signer));
})();

function getTokenAddresses(
  srcChain: ChainContext<Network>,
  dstChain: ChainContext<Network>,
  tokenSymbol: string,
) {
  const srcToken = tokens.filters.bySymbol(srcChain.config.tokenMap!, tokenSymbol);
  if (!srcToken || srcToken.length === 0) throw `No ${tokenSymbol} token on ${srcChain.chain}`;

  const dstToken = tokens.filters.bySymbol(dstChain.config.tokenMap!, tokenSymbol);
  if (!dstToken || dstToken.length === 0) throw `No ${tokenSymbol} token on ${dstChain.chain}`;

  return { srcToken: srcToken[0]!.address, dstToken: dstToken[0]!.address };
}
