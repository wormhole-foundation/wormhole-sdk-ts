import {
  isAttested,
  isCompleted,
  routes,
  TransferState,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-portico";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // Setup
  const wh = new Wormhole("Mainnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Ethereum");
  const destChain = wh.getChain("Polygon");
  const sender = await getStuff(sendChain);
  const receiver = await getStuff(destChain);

  // create new resolver, overriding the default routes
  const resolver = wh.resolver([routes.AutomaticPorticoRoute]);

  const possibleSourceTokens = await resolver.supportedSourceTokens(sendChain);
  console.log(`Supported source tokens for ${sendChain.chain}`, possibleSourceTokens);
  const sendingToken = possibleSourceTokens.pop()!;

  const destTokens = await resolver.supportedDestinationTokens(sendingToken, sendChain, destChain);
  const destToken = destTokens[0]!;
  console.log(`Supported destination tokens for ${sendingToken.toString()}`, destTokens);

  // Creating a transfer request fetches token details
  // since all routes will need to know about the tokens
  const tr = await routes.RouteTransferRequest.create(wh, {
    from: sender.address,
    to: receiver.address,
    source: sendingToken,
    destination: destToken,
  });

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);

  // Sort the routes given some input (not required for mvp)
  // const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;
  const bestRoute = foundRoutes[0]!;

  // Specify the amount as a decimal string
  const transferParams = {
    amount: "0.001",
  };

  let validated = await bestRoute.validate(transferParams);
  if (!validated.valid) throw validated.error;

  // initiate the transfer
  const receipt = await bestRoute.initiate(sender.signer, validated.params);
  console.log("Initiated transfer with receipt: ", receipt);

  // track the transfer until the destination is initiated
  const checkAndComplete = async (receipt: routes.Receipt) => {
    console.log("Checking transfer state...");

    // overwrite receipt var as we receive updates, will return when it's complete
    // but can be called again if the destination is not finalized
    for await (receipt of bestRoute.track(receipt, 120 * 1000)) {
      console.log("Transfer State:", TransferState[receipt.state]);
    }

    // gucci
    if (isCompleted(receipt)) return;

    // if the route is one we need to complete, do it
    if (routes.isManual(bestRoute) && isAttested(receipt)) {
      const completedTxids = await bestRoute.complete(receiver.signer, receipt);
      console.log("Completed transfer with txids: ", completedTxids);
    }

    // give it time to breath and try again
    const wait = 2 * 1000;
    console.log(`Transfer not complete, trying again in a ${wait}ms...`);
    setTimeout(() => checkAndComplete(receipt), wait);
  };

  await checkAndComplete(receipt);
})();
