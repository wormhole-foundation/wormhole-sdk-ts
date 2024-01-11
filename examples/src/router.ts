import {
  ChainAddress,
  Signer,
  TokenId,
  TransactionId,
  TransferQuote,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

type TransferRequest = {
  from: ChainAddress;
  to: ChainAddress;
  fromToken: TokenId | "native";
  toToken?: TokenId | "native";
  amount: bigint;
};

type SwapRouteOptions = {
  slippage: string;
};

type TransferRouteOptions = {};

type RouteOptions = SwapRouteOptions | TransferRouteOptions;
type Route = {
  quote: (ro: RouteOptions) => TransferQuote;
  execute: (signer: Signer, ro?: RouteOptions) => TransactionId[];
};

type Resolver = {
  resolve(tr: TransferRequest): Route[];
  sort(routes: Route[], sortBy: "cost" | "latency"): Route[];
};

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sender = await getStuff(wh.getChain("Sepolia"));
  const receiver = await getStuff(wh.getChain("Solana"));

  const tr: TransferRequest = {
    from: sender.address,
    to: receiver.address,
    amount: 100000n,
    fromToken: "native",
    toToken: "native",
  };

  // create new resolver
  // @ts-ignore
  const resolver: Resolver = wh.routeResolver();

  // resolve the transfer request to a set of routes that can perform it
  const routes: Route[] = resolver.resolve(tr);

  // Sort the routes given some input (not required for mvp)
  const bestRoute = resolver.sort(routes, "cost")[0]!;

  // grab a quote from the route to make sure it looks ok
  const opts: RouteOptions = { slippage: "0.00001" };
  console.log("Best route quoted at: ", bestRoute.quote(opts));

  // riggity run it
  const txids = bestRoute.execute(sender.signer, opts);
  console.log("Initiated transfer with txids: ", txids);
})();
