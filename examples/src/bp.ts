import { Wormhole, routes } from "@wormhole-foundation/connect-sdk";

import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Solana");
  const destChain = wh.getChain("Ethereum");
  const sender = await getStuff(sendChain);
  const receiver = await getStuff(destChain);

  // create new resolver, overriding the default routes
  const resolver = wh.resolver([routes.AutomaticMockRoute]);

  // What tokens are available on the source chain?
  console.log(await resolver.supportedSourceTokens(sendChain));
  // If we send "native" (gas token), what can we possibly get on the destination chain?
  console.log(
    await resolver.supportedDestinationTokens(
      Wormhole.tokenId(sendChain.chain, "native"),
      sendChain,
      destChain,
    ),
  );

  // Creating a transfer request fetches token details
  // since all routes will need to know about the tokens
  const tr = await routes.RouteTransferRequest.create(wh, {
    from: sender.address,
    to: receiver.address,
    source: Wormhole.tokenId(sendChain.chain, "native"),
    destination: Wormhole.tokenId(destChain.chain, "native"),
  });

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);

  // Sort the routes given some input (not required for mvp)
  // const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;
  const bestRoute = foundRoutes[0]!;
  console.log("Selected: ", bestRoute);

  // Specify the amount as a decimal string
  const transferParams = { amount: "0.001" };
  const validated = await bestRoute.validate(transferParams);
  if (!validated.valid) throw validated.error;

  // initiate the transfer
  const receipt = await bestRoute.initiate(sender.signer, validated.params);
  console.log("Initiated transfer with receipt: ", receipt);

  await routes.checkAndCompleteTransfer(bestRoute, receipt, receiver.signer);
})();
