import { Wormhole } from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
//
import { TransferStuff, getStuff } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  // spongebob-patrick-from-here-to-there.jpg
  const src = "Avalanche";
  const dst = "Ethereum";

  // Grab chain Contexts
  const sendChain = wh.getChain(src);
  const rcvChain = wh.getChain(dst);

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Regular Token Bridge Transfer
  // await tokenTransfer(wh, 'native', 100000n, source, destination, false);
  // await tokenTransfer(wh, 'native', 100000n, source, destination, true);

  // Circle USDC CCTP Transfer
  await cctpTransfer(wh, 100000n, source, destination, false);
  // await cctpTransfer(wh, 100000n, source, destination, true);
})();

async function tokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean
) {
  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  const xfer = await wh.tokenTransfer(
    token,
    amount,
    src.address,
    dst.address,
    automatic
  );
  console.log(xfer);

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started transfer: ${srcTxids}`);

  // 2) wait for the VAA to be signed and ready
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation();
  console.log(`Got Attestation: ${attestIds}`);

  // 3) redeem the VAA on the dest chain
  if (!automatic) {
    // 3a) Manual redemption passing a signer to sign any transactions
    console.log("Completing Transfer");
    const destTxids = await xfer.completeTransfer(dst.signer);
    console.log(`Completed Transfer: ${destTxids}`);
  } else {
    // 3b) Automatic redemption, tracking the redemption status
    console.log("TODO: track redemption");
  }
}

async function cctpTransfer(
  wh: Wormhole,
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean
) {
  const xfer = await wh.cctpTransfer(
    amount,
    src.address,
    dst.address,
    automatic
  );
  console.log(xfer);

  console.log("Starting Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started Transfer: ${srcTxids}`);

  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation(1000);
  console.log(`Got Attestation: ${attestIds}`);

  if (!automatic) {
    console.log("Completing Transfer");
    const dstTxids = await xfer.completeTransfer(dst.signer);
    console.log(`Completed Transfer: ${dstTxids}`);
  } else {
    console.log("TODO: track redemption");
  }
}
