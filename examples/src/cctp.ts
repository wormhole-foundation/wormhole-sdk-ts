import { Wormhole } from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
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
  const sendChain = wh.getChain("Ethereum");
  const rcvChain = wh.getChain("Avalanche");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Manual Circle USDC CCTP Transfer
  await cctpTransfer(wh, 8_000_000n, source, destination, false);

  // Automatic Circle USDC CCTP Transfer
  // await cctpTransfer(wh, 19_000_000n, source, destination, true);

  // Automatic Circle USDC CCTP Transfer With Gas Dropoff
  // await cctpTransfer(wh, 2_100_000n, source, destination, true, 1_000_000n);

  // Note: you can pick up a partial transfer from the origin chain name and txid
  // once created, you can call `fetchAttestations` and `completeTransfer` assuming its a manual transfer.
  // This is especially helpful for chains with longer time to finality where you don't want
  // to have to wait for the attestation to be generated.

  // const xfer = await CCTPTransfer.from(wh, {
  //   chain: "Ethereum",
  //   txid: "0x28054d963e2a671f9e62b9cefa5d67fb857dd8f2259ce645e136bf7957354a09",
  // });
  // console.log(xfer);
  // console.log(await xfer.fetchAttestation(60 * 60 * 1000));
  // console.log(await xfer.completeTransfer(destination.signer));

  //const xfer = await CCTPTransfer.from(wh, {
  //  message:
  //    "0000000000000001000000000000000000048de9000000000000000000000000eb08f243e5d3fcff26a9e38ae5520a669f4019d0000000000000000000000000d0c3da58f55358142b8d3e06c1c30c5c6114efe80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005425890298aed601595a70ab815c96711a31bc650000000000000000000000006603b4a7e29dfbdb6159c395a915e74757c1fb1300000000000000000000000000000000000000000000000000000000000f42400000000000000000000000006603b4a7e29dfbdb6159c395a915e74757c1fb13",
  //  msgHash: "",
  //});
  //console.log(xfer);
})();

async function cctpTransfer(
  wh: Wormhole,
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean,
  nativeGas?: bigint,
) {
  const xfer = await wh.cctpTransfer(
    amount,
    src.address,
    dst.address,
    automatic,
    undefined,
    nativeGas,
  );
  console.log(xfer);

  console.log("Starting Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started Transfer: `, srcTxids);

  if (automatic) return waitLog(xfer);

  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation();
  console.log(`Got Attestation: `, attestIds);

  console.log("Completing Transfer");
  const dstTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, dstTxids);
}
