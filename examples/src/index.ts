import {
  CCTPTransfer,
  TokenTransfer,
  TransferState,
  Wormhole,
  WormholeTransfer,
} from "@wormhole-foundation/connect-sdk";
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

Avax=>polygon never relayed?
0xb2f0c9ccb6e9e78f48113038fdea7b9b35ad3241586ae73a7ae959e7c8209710

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

  const xfer = await CCTPTransfer.from(wh, {
    chain: rcvChain.chain,
    txid: "0x67b2b6d6b7de45e791e1707b1e66d64255e5e1e0d781fdf01bcc12c78214cd9c",
  });
  console.log(await xfer.getTransferState());

  // Regular Token Bridge Transfer
  // await tokenTransfer(wh, "native", 10_000_000n, source, destination, false);
  // await tokenTransfer(
  //   wh,
  //   "native",
  //   1_000_000_000_000n,
  //   source,
  //   destination,
  //   true
  // );

  // Circle USDC CCTP Transfer
  // await cctpTransfer(wh, 1_000_000n, source, destination, false);

  // Note: auto relay takes 0.1usdc or 1usdc?
  // 0xdb98291d3dcf85419f431c3245f91a2fa3faecae5674865d2df5d2c85935d129
  // await cctpTransfer(wh, 19_000_000n, source, destination, true);
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

  // If automatic, we're done
  if (automatic) return waitLog(xfer);

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation();
  console.log(`Got Attestation: ${attestIds}`);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: ${destTxids}`);
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

  if (automatic) return waitLog(xfer);

  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation(1000);
  console.log(`Got Attestation: ${attestIds}`);

  console.log("Completing Transfer");
  const dstTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: ${dstTxids}`);
}

async function waitLog(xfer: WormholeTransfer): Promise<void> {
  console.log("Checking for complete status");
  while ((await xfer.getTransferState()) < TransferState.Completed) {
    console.log("Not yet...");
    await new Promise((f) => setTimeout(f, 2000));
  }
}
