import { Wormhole, routes } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-portico";

(async function () {
  const wh = new Wormhole("Mainnet", [EvmPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Optimism");
  const rcvChain = wh.getChain("Arbitrum");

  const sender = await getStuff(sendChain);
  const receiver = await getStuff(rcvChain);

  const resolver = wh.resolver([routes.PorticoRoute]);

  // Creating a transfer request fetches token details
  // since all routes will need to know about the tokens
  const tr = await routes.RouteTransferRequest.create(wh, {
    from: sender.address,
    to: receiver.address,
    source: "native",
    destination: "native",
  });

  const foundRoutes = await resolver.findRoutes(tr);

  const route = foundRoutes.pop()!;
  const validated = await route.validate({ amount: "0.001" });
  if (!validated.valid) throw validated.error;

  console.log("Validated inputs: ", validated);

  const quote = await route.quote(validated.params);
  console.log(quote);

  const receipt = await route.initiate(sender.signer, validated.params);
  console.log(receipt);
})();
