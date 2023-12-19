import {
  CircleTransfer,
  Network,
  Signer,
  TransactionId,
  Wormhole,
  normalizeAmount,
  Platform,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { TransferStuff, getStuff, waitForRelay } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-cctp";
import "@wormhole-foundation/connect-sdk-solana-cctp";

/*
Notes:
Only a subset of chains are supported by Circle for CCTP, see core/base/src/constants/circle.ts for currently supported chains

AutoRelayer takes a 0.1usdc fee when xfering to any chain beside goerli, which is 1 usdc
*/

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Solana");
  const rcvChain = wh.getChain("Avalanche");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // 6 decimals for USDC (mostly?)
  const amount = normalizeAmount("0.01", 6n);

  // Manual Circle USDC CCTP Transfer
  // await cctpTransfer(wh, amount, source, destination, false);

  const automatic = false;

  // Automatic Circle USDC CCTP Transfer
  const fee = !automatic
    ? 0n
    : await sendChain.getAutomaticCircleBridge().then((acb) => acb.getRelayerFee(rcvChain.chain));

  await cctpTransfer(wh, source, destination, {
    amount: amount + fee,
    automatic: false,
  });

  // Automatic Circle USDC CCTP Transfer With Gas Dropoff
  // const nativeGasAmt = 1_000_000n
  // await cctpTransfer(wh, amount + fee, source, destination, true, nativeGasAmt);

  // Note: you can pick up a partial transfer from the origin chain name and txid
  // once created, you can call `fetchAttestations` and `completeTransfer` assuming its a manual transfer.
  // This is especially helpful for chains with longer time to finality where you don't want
  // to have to wait for the attestation to be generated.

  // await completeTransfer(
  //   wh,
  //   {
  //     chain: sendChain.chain,
  //     txid: "0xfe374b6e3ea032c05eb244e5c310047bc779f5cc389a2a0e3fccbf07fb2ae8a2",
  //   },
  //   destination.signer,
  // );
})();

async function cctpTransfer<N extends Network>(
  wh: Wormhole<N>,
  src: TransferStuff<N, Platform>,
  dst: TransferStuff<N, Platform>,
  req: {
    amount: bigint;
    automatic: boolean;
    nativeGas?: bigint;
  },
) {
  const xfer = await wh.circleTransfer(
    req.amount,
    src.address,
    dst.address,
    req.automatic,
    undefined,
    req.nativeGas,
  );
  console.log(xfer);

  console.log("Starting Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started Transfer: `, srcTxids);

  if (req.automatic) {
    const relayStatus = await waitForRelay(srcTxids[srcTxids.length - 1]!);
    console.log(`Finished relay: `, relayStatus);
    return;
  }

  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation();
  console.log(`Got Attestation: `, attestIds);

  console.log("Completing Transfer");
  const dstTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, dstTxids);
}

export async function completeTransfer(
  wh: Wormhole<Network>,
  txid: TransactionId,
  signer: Signer,
): Promise<void> {
  // Rebuild the transfer from the source txid
  const xfer = await CircleTransfer.from(wh, txid);

  const attestIds = await xfer.fetchAttestation(60 * 60 * 1000);
  console.log("Got attestation: ", attestIds);

  const dstTxIds = await xfer.completeTransfer(signer);
  console.log("Completed transfer: ", dstTxIds);
}
