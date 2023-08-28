import { TokenTransfer, Wormhole } from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { TokenId, TxHash } from "@wormhole-foundation/sdk-definitions";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
//
import { TransferStuff, getStuff } from "./helpers";

/*
TODOS:

- Test different Assets
- Test Automatic redeem

- gas dropoff
- track automatic completion
- event emission/subscription for status changes 
- add gateway protocol 


- Validation of inputs (amount > dust, etc..)

- re-export from connect?
- gas estimation?
- use fetchAttestations in complete transfer instead of erroring?


Track down: 0xb2f0c9ccb6e9e78f48113038fdea7b9b35ad3241586ae73a7ae959e7c8209710


*/

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Polygon");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Regular Token Bridge Transfer
  // await tokenTransfer(wh, "native", 10_000_000n, source, destination, false);
  await tokenTransfer(
    wh,
    "native",
    1_000_000_000_000n,
    source,
    destination,
    true
  );

  // Or pickup from in-flight transfer
  // await completeTokenTranfer(
  //   wh,
  //   source,
  //   destination,
  //   "0x4b251da18f4ff18acdc05804a7ed35341bf56365d940f269282241469df33a83"
  // );

  // Circle USDC CCTP Transfer
  // await cctpTransfer(wh, 1_000_000n, source, destination, false);
  // await cctpTransfer(wh, 1_000_000n, source, destination, true);
})();

async function completeTokenTranfer(
  wh: Wormhole,
  src: TransferStuff,
  dst: TransferStuff,
  txid: TxHash
): Promise<void> {
  const xfer = await TokenTransfer.from(wh, {
    chain: src.chain.chain,
    txid: txid,
  });
  const s = await xfer.getTransferState();
  console.log("Current state", s);
  // const attestIds = await xfer.fetchAttestation();
  // console.log("Got attestations");
  // console.log(attestIds);

  // console.log(await xfer.completeTransfer(dst.signer));
}

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

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation();
  console.log(`Got Attestation: ${attestIds}`);

  if (!automatic) {
    // 3) redeem the VAA on the dest chain
    console.log("Completing Transfer");
    const destTxids = await xfer.completeTransfer(dst.signer);
    console.log(`Completed Transfer: ${destTxids}`);
  } else {
    // 2) Automatic redemption, tracking the redemption status
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

  if (!automatic) {
    console.log("Waiting for Attestation");
    const attestIds = await xfer.fetchAttestation(1000);
    console.log(`Got Attestation: ${attestIds}`);

    console.log("Completing Transfer");
    const dstTxids = await xfer.completeTransfer(dst.signer);
    console.log(`Completed Transfer: ${dstTxids}`);
  } else {
    console.log("TODO: track redemption");
  }
}
