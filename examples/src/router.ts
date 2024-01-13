import { routes, TransferState, Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sender = await getStuff(wh.getChain("Solana"));
  const receiver = await getStuff(wh.getChain("Avalanche"));

  const tr: routes.RouteTransferRequest = {
    from: sender.address,
    to: receiver.address,
    amount: 35000000n,
    source: "native",
    destination: "native",
  };

  // create new resolver
  const resolver = wh.resolver();

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);

  // Sort the routes given some input (not required for mvp)
  // const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;
  const bestRoute = foundRoutes.filter((route) => routes.isAutomatic(route))[0]!;

  const opts = bestRoute.getDefaultOptions();
  console.log(opts);

  const validated = await bestRoute.validate(opts);
  if (!validated.valid) throw validated.error;

  // grab a quote from the route to make sure it looks ok
  const quote = bestRoute.quote(opts);
  console.log("Best route quoted at: ", quote);

  // initiate the transfer
  let receipt = await bestRoute.initiate(sender.signer, bestRoute.getDefaultOptions());
  console.log("Initiated transfer with receipt: ", receipt);

  // if the route is one we need to complete, do it
  if (routes.isCompletable(bestRoute)) {
    const completedTxids = await bestRoute.complete(receiver.signer, receipt);
    console.log("Completed transfer with txids: ", completedTxids);
  }

  // track the transfer until the destination is initiated
  while (receipt.state <= TransferState.DestinationInitiated) {
    const tracker = bestRoute.track(receipt);
    for await (const _receipt of tracker) {
      console.log("Current transfer state: ", TransferState[receipt.state]);
      receipt = _receipt;
    }
  }
})();
