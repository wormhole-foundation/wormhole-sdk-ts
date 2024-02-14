import {
  Network,
  Signer,
  TransferState,
  Wormhole,
  amount,
  canonicalAddress,
  isAttested,
  isCompleted,
  routes,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-portico";
import "@wormhole-foundation/connect-sdk-evm-cctp";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-cctp";

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Solana");
  const destChain = wh.getChain("Ethereum");
  const sender = await getStuff(sendChain);
  const receiver = await getStuff(destChain);

  // we're sending the "native" (gas token of src chain)
  const sendToken = Wormhole.tokenId(sendChain.chain, "native");

  // create new resolver, passing the set of routes to consider
  const resolver = wh.resolver([
    routes.AutomaticTokenBridgeRoute,
    routes.TokenBridgeRoute,
    routes.CCTPRoute,
    routes.AutomaticCCTPRoute,
    routes.AutomaticPorticoRoute,
  ]);

  // what tokens are available on the source chain?
  const srcTokens = await resolver.supportedSourceTokens(sendChain);
  console.log(
    "The following tokens may be sent: ",
    srcTokens.map((t) => canonicalAddress(t)),
  );

  // given the send token, what can we possibly get on the destination chain?
  const destTokens = await resolver.supportedDestinationTokens(sendToken, sendChain, destChain);
  console.log(
    "For the given source token, the following tokens may be receivable: ",
    destTokens.map((t) => canonicalAddress(t)),
  );

  // creating a transfer request fetches token details
  // since all routes will need to know about the tokens
  const tr = await routes.RouteTransferRequest.create(wh, {
    from: sender.address,
    to: receiver.address,
    source: sendToken,
    destination: destTokens.pop()!,
  });

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);

  // Sort the routes given some input (not required for mvp)
  // const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;
  const bestRoute = foundRoutes[0]!;
  console.log("Selected: ", bestRoute);

  console.log("This route offers the following default options", bestRoute.getDefaultOptions());
  // Create the transfer params for this request
  // Specify the amount as a decimal string
  const transferParams = { amount: "0.2", options: { nativeGas: 0.1 } };
  let validated = await bestRoute.validate(transferParams);
  if (!validated.valid) throw validated.error;
  console.log("Validated transfer params: ", validated.params);

  const quote = await bestRoute.quote(validated.params);
  if (!quote.success) throw quote.error;

  console.log("Best route quote: ", quote);

  if (quote.destinationNativeGas) {
    console.log("Destination native gas: ", amount.display(quote.destinationNativeGas, 4));
  }

  return;
  await execute(bestRoute, sender.signer, receiver.signer, quote);
})();

async function execute<N extends Network>(
  route: routes.Route<N>,
  sender: Signer<N>,
  receiver: Signer<N>,
  validated: routes.Quote<routes.Options>,
) {
  // initiate the transfer
  const receipt = await route.initiate(sender, validated);
  console.log("Initiated transfer with receipt: ", receipt);

  // track the transfer until the destination is initiated
  const checkAndComplete = async (receipt: routes.Receipt) => {
    console.log("Checking transfer state...");

    // overwrite receipt var as we receive updates, will return when it's complete
    // but can be called again if the destination is not finalized
    for await (receipt of route.track(receipt, 120 * 1000)) {
      console.log("Transfer State:", TransferState[receipt.state]);
    }

    // gucci
    if (isCompleted(receipt)) return;

    // if the route is one we need to complete, do it
    if (routes.isManual(route) && isAttested(receipt)) {
      const completedTxids = await route.complete(receiver, receipt);
      console.log("Completed transfer with txids: ", completedTxids);
    }

    // give it time to breath and try again
    const wait = 2 * 1000;
    console.log(`Transfer not complete, trying again in a ${wait}ms...`);
    setTimeout(() => checkAndComplete(receipt), wait);
  };

  await checkAndComplete(receipt);
}
