import {
  Chain,
  Network,
  Platform,
  Signer,
  TokenId,
  TokenTransfer,
  TransactionId,
  Wormhole,
  nativeChainAddress,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { TransferStuff, getStuff, waitLog } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-core";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform, CosmwasmPlatform]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Solana");
  const rcvChain = wh.getChain("Avalanche");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  const amt = normalizeAmount("0.01", BigInt(sendChain.config.nativeTokenDecimals));

  // Choose your adventure

  const xfer = await manualTokenTransfer(wh, "native", amt, source, destination);
  console.log(xfer);

  // what token did we mint? we want to send it back
  // const destToken = await TokenTransfer.lookupDestinationToken(wh, xfer.transfer);
  // console.log(destToken);

  // const xferBack = await manualTokenTransfer(wh, destToken, amt, destination, source);
  // console.log(xferBack);

  // await automaticTokenTransfer(wh, "native", 100_000_000n, source, destination);
  // await automaticTokenTransferWithGasDropoff(
  //   wh,
  //   "native",
  //   100_000_000n,
  //   source,
  //   destination,
  //   2_000_000_000_000n
  // );

  // const payload = encoding.toUint8Array("hai")
  // await manualTokenTransferWithPayload(wh, "native", 100_000_000n, source, destination, payload);
  // await automaticTokenTransferWithPayload(wh, "native", 100_000_000n, source, destination, payload);
  // await automaticTokenTransferWithPayloadAndGasDropoff(
  //   wh,
  //   "native",
  //   100_000_000n,
  //   source,
  //   destination,
  //   2_000_000_000_000n,
  //   payload
  // );

  // Or, if you have an incomplete transfer, pick up from where you
  // left off given the source transaction

  // await finishTransfer(
  //   wh,
  //   sendChain.chain,
  //   "0xaed2eb6361283dab84aeb3d211935458f971c38d1238d29b4c8bae63c76ede00",
  //   destination.signer,
  // );
})();

async function tokenTransfer<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff<N, Platform, Chain>,
  dst: TransferStuff<N, Platform, Chain>,
  automatic: boolean,
  nativeGas?: bigint,
  payload?: Uint8Array,
): Promise<TokenTransfer<N>> {
  const xfer = await wh.tokenTransfer(
    token,
    amount,
    src.address,
    dst.address,
    automatic,
    payload,
    nativeGas,
  );

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started transfer: `, srcTxids);

  // If automatic, we're done
  if (automatic) {
    await waitLog(xfer);
    return xfer;
  }

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, destTxids);

  return xfer;
}

// If you've started a transfer but not completed it
// this method will complete the transfer given the source
// chain and transaction id
export async function finishTransfer<N extends Network, C extends Chain>(
  wh: Wormhole<Network>,
  txid: TransactionId,
  signer: Signer,
): Promise<TokenTransfer<N>> {
  const xfer = await TokenTransfer.from(wh, txid);
  console.log(xfer);
  console.log("Completion txids: ", await xfer.completeTransfer(signer));
  return xfer;
}

async function manualTokenTransfer<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff<N, Platform, Chain>,
  dst: TransferStuff<N, Platform, Chain>,
) {
  return tokenTransfer(wh, token, amount, src, dst, false);
}

// async function automaticTokenTransfer(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true);
// }
//
// async function automaticTokenTransferWithGasDropoff(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   nativeGas: bigint,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true, nativeGas);
// }
//
// async function manualTokenTransferWithPayload(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   payload: Uint8Array,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, false, undefined, payload);
// }
//
// async function automaticTokenTransferWithPayload(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   payload: Uint8Array,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true, undefined, payload);
// }
//
// async function automaticTokenTransferWithPayloadAndGasDropoff(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   nativeGas: bigint,
//   payload: Uint8Array,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true, nativeGas, payload);
// }
