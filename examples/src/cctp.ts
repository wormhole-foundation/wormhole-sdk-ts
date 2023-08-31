import { Wormhole } from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
//
import { TransferStuff, getStuff, waitLog } from "./helpers";

/*
Notes:

Only a subset of chains are supported by Circle for CCTP, see core/base/src/constants/circle.ts for currently supported chains

AutoRelayer takes a 0.1usdc fee when xfering to any chain beside goerli, which is 1 usdc

*/

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Ethereum");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Manual Circle USDC CCTP Transfer
  await cctpTransfer(wh, 1_000_000n, source, destination, false);

  // Automatic Circle USDC CCTP Transfer
  // await cctpTransfer(wh, 19_000_000n, source, destination, true);

  // Automatic Circle USDC CCTP Transfer With Gas Dropoff
  // await cctpTransfer(wh, 2_100_000n, source, destination, true, 1_000_000n);
})();

async function cctpTransfer(
  wh: Wormhole,
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean,
  nativeGas?: bigint
) {
  const xfer = await wh.cctpTransfer(
    amount,
    src.address,
    dst.address,
    automatic,
    undefined,
    nativeGas
  );
  console.log(xfer);

  console.log("Starting Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started Transfer: `, srcTxids);

  if (automatic) return waitLog(xfer);

  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation(1000);
  console.log(`Got Attestation: `, attestIds);

  console.log("Completing Transfer");
  const dstTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, dstTxids);
}
