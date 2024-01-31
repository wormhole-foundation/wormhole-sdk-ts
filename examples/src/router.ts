import {
  deserialize,
  encoding,
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

//
// {
//   amount: '0.2',
//   options: { nativeGas: 1 },
//   normalizedParams: {
//     fee: { amount: '13951187', decimals: 9 },
//     amount: { amount: '200000000', decimals: 9 },
//     nativeGasAmount: { amount: '186048813', decimals: 18 }
//   }
// }
// 0n 200000000n 186048813n 13951187n
// {
//   sourceToken: {
//     token: { chain: 'Solana', address: [SolanaAddress] },
//     amount: { amount: '200000000', decimals: 9 }
//   },
//   destinationToken: {
//     token: { chain: 'Ethereum', address: [EvmAddress] },
//     amount: { amount: '0', decimals: 18 }
//   },
//   relayFee: {
//     token: { chain: 'Solana', address: [SolanaAddress] },
//     amount: { amount: '13951187', decimals: 9 }
//   },
//   destinationNativeGas: { amount: '8078310718883405', decimals: 18 }
// }

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Ethereum");
  const destChain = wh.getChain("Solana");
  const sender = await getStuff(sendChain);
  const receiver = await getStuff(destChain);

  // create new resolver, overriding the default routes
  const resolver = wh.resolver([routes.AutomaticTokenBridgeRoute]);

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
  const transferParams = {
    amount: "0.2",
  };

  let validated = await bestRoute.validate(transferParams);
  if (!validated.valid) throw validated.error;

  console.log(validated.params);
  const quote = await bestRoute.quote(validated.params);
  console.log(quote);

  const dtb = await destChain.getAutomaticTokenBridge();
  const maxSwapAmt = await dtb.maxSwapAmount(
    Wormhole.parseAddress("Solana", "7VPWjBhCXrpYYBiRKZh1ubh9tLZZNkZGp2ReRphEV4Mc"),
  );
  console.log(maxSwapAmt);

  return;

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
