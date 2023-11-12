// import {
//   CircleTransfer,
//   Network,
//   Signer,
//   TransactionId,
//   Wormhole,
//   normalizeAmount,
// } from "@wormhole-foundation/connect-sdk";
// import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
// import { TransferStuff, getStuff, waitLog } from "./helpers";
//
// import "@wormhole-foundation/connect-sdk-evm-core";
// import "@wormhole-foundation/connect-sdk-evm-cctp";
// import { Platform } from "@wormhole-foundation/sdk-base/src";

/*
Notes:
Only a subset of chains are supported by Circle for CCTP, see core/base/src/constants/circle.ts for currently supported chains

AutoRelayer takes a 0.1usdc fee when xfering to any chain beside goerli, which is 1 usdc
*/

// (async function () {
//   // init Wormhole object, passing config for which network
//   // to use (e.g. Mainnet/Testnet) and what Platforms to support
//   const wh = new Wormhole("Testnet", [EvmPlatform]);
//
//   // Grab chain Contexts
//   const sendChain = wh.getChain("Avalanche");
//   const rcvChain = wh.getChain("Ethereum");
//
//   // Get signer from local key but anything that implements
//   // Signer interface (e.g. wrapper around web wallet) should work
//   const source = await getStuff(sendChain);
//   const destination = await getStuff(rcvChain);
//
//   // 6 decimals for USDC (mosltly)
//   const amount = normalizeAmount("0.01", 6n);
//
//   // Manual Circle USDC CCTP Transfer
//   await cctpTransfer(wh, amount, source, destination, false);
//
//   // Automatic Circle USDC CCTP Transfer
//   // await cctpTransfer(wh, 19_000_000n, source, destination, true);
//
//   // Automatic Circle USDC CCTP Transfer With Gas Dropoff
//   // await cctpTransfer(wh, 2_100_000n, source, destination, true, 1_000_000n);
//
//   // Note: you can pick up a partial transfer from the origin chain name and txid
//   // once created, you can call `fetchAttestations` and `completeTransfer` assuming its a manual transfer.
//   // This is especially helpful for chains with longer time to finality where you don't want
//   // to have to wait for the attestation to be generated.
//
//   //await completeTransfer(wh, {
//   //  chain: "Avalanche",
//   //  txid: "0x4695a5ae7ed2efcf2d585bdb2e64436f6b8bd67fe547789d8b8ba6fab6d9483f",
//   //});
// })();
//
// async function cctpTransfer(
//   wh: Wormhole<Network>,
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   automatic: boolean,
//   nativeGas?: bigint,
// ) {
//   const xfer = await wh.circleTransfer(
//     amount,
//     src.address,
//     dst.address,
//     automatic,
//     undefined,
//     nativeGas,
//   );
//   console.log(xfer);
//
//   console.log("Starting Transfer");
//   const srcTxids = await xfer.initiateTransfer(src.signer);
//   console.log(`Started Transfer: `, srcTxids);
//
//   if (automatic) return waitLog(xfer);
//
//   console.log("Waiting for Attestation");
//   const attestIds = await xfer.fetchAttestation();
//   console.log(`Got Attestation: `, attestIds);
//
//   console.log("Completing Transfer");
//   const dstTxids = await xfer.completeTransfer(dst.signer);
//   console.log(`Completed Transfer: `, dstTxids);
// }
//
// async function completeTransfer(wh: Wormhole, txid: TransactionId, signer: Signer): Promise<void> {
//   // Rebuild the transfer from the source txid
//   const xfer = await CircleTransfer.from(wh, txid);
//
//   const attestIds = await xfer.fetchAttestation(60 * 60 * 1000);
//   console.log("Got attestation: ", attestIds);
//
//   const dstTxIds = await xfer.completeTransfer(signer);
//   console.log("Completed transfer: ", dstTxIds);
// }
//
