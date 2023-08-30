import {
  TokenTransfer,
  TransferState,
  Wormhole,
  WormholeTransfer,
} from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
//
import { TransferStuff, getStuff } from "./helpers";
import { PublicKey } from "@solana/web3.js";

/*
TODOS:

- Arbitrum rpc?
- Test !native Assets in token bridge 
- Better tracking of auto-redeem, use target contract?
- gas dropoff
- tx finalization estimate
- event emission/subscription for status changes 
- add gateway protocol 
- Validation of inputs (amount > dust, etc..)
- re-export common types from connect?
- gas estimation of routes?

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

  /*
  Token Transfer 
  */
  // // Manual Token Bridge Transfer
  await tokenTransfer(wh, "native", 10_000_000n, source, destination, false);

  // const xfer = await TokenTransfer.from(wh, {
  //   chain: "Solana",
  //   txid: "5DEejHAwzBtSZYb3NU7vNeHFu9oLhijD97YFKqT69LQY2tGDF18y1GmyxfnnUdMCj4sT21Ffo6nGaFh959RixG4F",
  // });
  // console.log(await xfer.completeTransfer(destination.signer));

  // // Automatic Token Bridge Transfer
  // await tokenTransfer(
  //   wh,
  //   "native",
  //   1_000_000_000_000n,
  //   source,
  //   destination,
  //   true
  // );

  // Automatic Token Bridge Transfer With Gas Dropoff
  // await tokenTransfer(
  //   wh,
  //   "native",
  //   1_000_000_000_000n,
  //   source,
  //   destination,
  //   true,
  //   2_000_000_000_000n
  // );

  /*
  CCTP
  */
  // // Manual Circle USDC CCTP Transfer
  // await cctpTransfer(wh, 1_000_000n, source, destination, false);

  // // Note: auto relay takes 0.1usdc when xfering to any chain beside goerli, which is 1 usdc
  // // Automatic Circle USDC CCTP Transfer
  // await cctpTransfer(wh, 19_000_000n, source, destination, true);
  // // Automatic Circle USDC CCTP Transfer With Gas Dropoff
  // await cctpTransfer(wh, 2_100_000n, source, destination, true, 1_000_000n);
})();

async function tokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean,
  nativeGas?: bigint
) {
  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  const xfer = await wh.tokenTransfer(
    token,
    amount,
    src.address,
    dst.address,
    automatic,
    undefined,
    nativeGas
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

async function waitLog(xfer: WormholeTransfer): Promise<void> {
  console.log("Checking for complete status");
  console.log(xfer);
  while ((await xfer.getTransferState()) < TransferState.Completed) {
    console.log("Not yet...");
    await new Promise((f) => setTimeout(f, 5000));
  }
}
