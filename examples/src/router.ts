import { routes, Wormhole } from "@wormhole-foundation/connect-sdk";
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
    amount: 100000n,
    source: await sender.chain.getNativeWrappedTokenId(),
  };

  // create new resolver
  const resolver = wh.resolver();

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);

  // Sort the routes given some input (not required for mvp)
  const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;

  // grab a quote from the route to make sure it looks ok
  //console.log("Best route quoted at: ", bestRoute.quote(opts));

  // riggity run it

  const opts: routes.TokenBridgeRoute.Options = {};
  const result = await bestRoute.initiate(sender.signer, opts);
  console.log("Initiated transfer with txids: ", result);

  if (routes.isCompletable(bestRoute)) {
    const completedTxids = await bestRoute.complete(receiver.signer, result);
    console.log("Completed transfer with txids: ", completedTxids);
  }
})();
