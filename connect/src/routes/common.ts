import type { Network } from "@wormhole-foundation/sdk-base";
import type { Signer } from "@wormhole-foundation/sdk-definitions";
import type { Receipt } from "./types.js";
import type { Route } from "./route.js";
import { isFinalizable, isManual } from "./route.js";
import { TransferState, isAttested, isCompleted, isRedeemed } from "../types.js";

/**
 * track the transfer until the destination is initiated
 *
 * @param route The route that can be used to track the receipt
 * @param receipt The receipt to track
 * @param destinationSigner The signer for the destination chain if
 */
export async function checkAndCompleteTransfer<N extends Network>(
  route: Route<N>,
  receipt: Receipt,
  destinationSigner?: Signer<N>,
  timeout: number = 120 * 1000,
  // byo logger but im dumping to console rn 🙃
  log: typeof console.log = console.log,
) {
  const start = Date.now();
  log("Checking transfer state...");

  // overwrite receipt var as we receive updates, will return when it's complete
  // but can be called again if the destination is not finalized
  // this construct is to drain an async generator and return the last value
  for await (receipt of route.track(receipt, 120 * 1000)) {
    log("Current Transfer State: ", TransferState[receipt.state]);
  }

  // gucci
  if (isCompleted(receipt)) return receipt;

  // if the route is one we need to complete, do it
  if (isManual(route) && isAttested(receipt) && destinationSigner) {
    log("Completing transfer...");
    const completedTxids = await route.complete(destinationSigner, receipt);
    log("Completed transfer with txids: ", completedTxids);
  }

  // if the route is one we need to finalize, do it
  if (isFinalizable(route) && isRedeemed(receipt) && destinationSigner) {
    log("Finalizing transfer...");
    const completedTxids = await route.finalize(destinationSigner, receipt);
    log("Finalized transfer with txids: ", completedTxids);
  }

  const leftover = timeout - (Date.now() - start);
  // do we still have time?
  if (leftover > 0) {
    // give it a second, computers need to rest sometimes
    const wait = 2 * 1000;
    log(`Transfer not complete, trying again in a ${wait}ms...`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return checkAndCompleteTransfer(route, receipt, destinationSigner, leftover);
  }

  return receipt;
}
