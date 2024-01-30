import { Network } from "@wormhole-foundation/sdk-base";
import { Signer } from "@wormhole-foundation/sdk-definitions";
import { Receipt } from "./types";
import { Route, isManual } from "./route";
import { TransferState, isAttested, isCompleted } from "../types";

// TODO: take out logs

// track the transfer until the destination is initiated
export async function checkAndCompleteTransfer<N extends Network>(
  route: Route<N>,
  receipt: Receipt,
  destinationSigner: Signer<N>,
) {
  console.log("Checking transfer state...");

  // overwrite receipt var as we receive updates, will return when it's complete
  // but can be called again if the destination is not finalized
  for await (receipt of route.track(receipt, 120 * 1000)) {
    console.log("Transfer State:", TransferState[receipt.state]);
  }

  // gucci
  if (isCompleted(receipt)) return;

  // if the route is one we need to complete, do it
  if (isManual(route) && isAttested(receipt)) {
    const completedTxids = await route.complete(destinationSigner, receipt);
    console.log("Completed transfer with txids: ", completedTxids);
  }

  // give it time to breath and try again
  const wait = 2 * 1000;
  console.log(`Transfer not complete, trying again in a ${wait}ms...`);
  setTimeout(() => checkAndCompleteTransfer(route, receipt, destinationSigner), wait);
}
