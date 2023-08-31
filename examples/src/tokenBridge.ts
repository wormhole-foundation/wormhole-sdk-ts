import { Wormhole } from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
//
import { TransferStuff, getStuff, waitLog } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Solana");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Manual Token Bridge Transfer
  await tokenTransfer(wh, "native", 10_000_000n, source, destination, false);

  // Automatic Token Bridge Transfer
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

  if (dst.address.chain === "Solana") {
    //getAssociatedTokenAddress();
    //dst.chain.platform.get;
  }

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
