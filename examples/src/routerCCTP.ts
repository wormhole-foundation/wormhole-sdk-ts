import {
  AttestationReceipt,
  Chain,
  Network,
  ProtocolName,
  TransferReceipt,
  TransferState,
  Wormhole,
  circle,
  routes,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-cctp";
import "@wormhole-foundation/connect-sdk-solana-cctp";

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Polygon");
  const sender = await getStuff(sendChain);
  const receiver = await getStuff(rcvChain);

  // create new resolver
  const resolver = wh.resolver([routes.CCTPRoute, routes.AutomaticCCTPRoute]);

  const usdcAddress = (network: Network, chain: Chain) =>
    Wormhole.chainAddress(chain, circle.usdcContract.get(network, chain)!);

  const srcUsdc = usdcAddress(sendChain.network, sendChain.chain);
  const dstUsdc = usdcAddress(rcvChain.network, rcvChain.chain);

  // Creating a transfer request fetches token details
  // since all routes will need to know about the tokens
  const tr = await routes.RouteTransferRequest.create(wh, {
    from: sender.address,
    to: receiver.address,
    source: srcUsdc,
    destination: dstUsdc,
  });

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  console.log("For the transfer parameters, we found these routes: ", foundRoutes);

  // Sort the routes given some input (not required for mvp)
  // const bestRoute = (await resolver.sortRoutes(foundRoutes, "cost"))[0]!;
  //const bestRoute = foundRoutes.filter((route) => routes.isAutomatic(route))[0]!;
  const bestRoute = foundRoutes.pop()!;

  console.log(bestRoute);

  // Specify the amount as a decimal string
  const transferParams = {
    amount: "1.5",
  };

  let validated = await bestRoute.validate(transferParams);
  if (!validated.valid) throw validated.error;
  console.log("Validated: ", validated);

  const quote = await bestRoute.quote(validated.params);
  if (!quote.success) throw quote.error;

  // initiate the transfer
  const receipt = await bestRoute.initiate(sender.signer, quote);
  console.log("Initiated transfer with receipt: ", receipt);

  // track the transfer until the destination is initiated
  const checkAndComplete = async (receipt: TransferReceipt<AttestationReceipt<ProtocolName>>) => {
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
        return;
      }
    }

    // give it time to breath and try again
    const wait = 2 * 1000;
    console.log(`Transfer not complete, trying again in a ${wait}ms...`);
    setTimeout(() => checkAndComplete(receipt), wait);
  };

  await checkAndComplete(receipt);
})();
