import {
  ProtocolName,
  routes,
  TransferReceipt,
  TransferState,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
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
  const resolver = wh.resolver([routes.AutomaticTokenBridgeRoute]);

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);

  // Sort the routes given some input (not required for mvp)
  // const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;
  //const bestRoute = foundRoutes.filter((route) => routes.isAutomatic(route))[0]!;
  const bestRoute = foundRoutes[0]!;

  let validated = await bestRoute.validate();
  if (!validated.valid) throw validated.error;

  // initiate the transfer
  const receipt = await bestRoute.initiate(sender.signer, validated.options);
  console.log("Initiated transfer with receipt: ", receipt);

  // track the transfer until the destination is initiated
  const checkAndComplete = async (receipt: TransferReceipt<ProtocolName>) => {
    console.log("Checking transfer state...");
    // overwrite receipt var
    for await (receipt of bestRoute.track(receipt, 120 * 1000)) {
      console.log("Transfer State:", TransferState[receipt.state]);
    }

    // gucci
    if (receipt.state >= TransferState.DestinationFinalized) return;

    // if the route is one we need to complete, do it
    if (receipt.state === TransferState.Attested) {
      if (routes.isManual(bestRoute)) {
        const completedTxids = await bestRoute.complete(receiver.signer, receipt);
        console.log("Completed transfer with txids: ", completedTxids);
      }
    }

    // give it time to breath and try again
    const wait = 2 * 1000;
    console.log(`Transfer not complete, trying again in a ${wait}ms...`);
    setTimeout(() => checkAndComplete(receipt), wait);
  };

  await checkAndComplete(receipt);
})();
