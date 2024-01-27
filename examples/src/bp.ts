import {
  Chain,
  ChainContext,
  CompletedTransferReceipt,
  Network,
  Signer,
  SourceInitiatedTransferReceipt,
  TokenId,
  TransferState,
  Wormhole,
  encoding,
  nativeTokenId,
  routes,
} from "@wormhole-foundation/connect-sdk";

import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Op = {};
type R = routes.Receipt;
type Q = routes.Quote;

export class AutomaticFauxRoute<N extends Network>
  extends routes.AutomaticRoute<N, Op, R, Q>
  implements routes.StaticRouteMethods<typeof AutomaticFauxRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticFauxBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  static supportedChains(network: Network): Chain[] {
    return ["Solana", "Ethereum"];
  }
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    await delay(250);
    return [nativeTokenId(fromChain.chain)];
  }
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    await delay(250);
    return [nativeTokenId(toChain.chain)];
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async validate(params: routes.TransferParams<Op>): Promise<routes.ValidationResult<Op>> {
    await delay(250);
    return {
      valid: true,
      params: { ...params, options: this.getDefaultOptions() },
    };
  }

  async quote(params: routes.ValidatedTransferParams<Op>): Promise<Q> {
    const fakeQuote: Q = {
      sourceToken: {
        token: this.request.source.id,
        amount: params.amount,
      },
      destinationToken: {
        token: this.request.destination!.id,
        amount: params.amount,
      },
      relayFee: {
        token: this.request.source.id,
        amount: "0.01",
      },
    };
    return fakeQuote;
  }

  async initiate(sender: Signer, params: routes.ValidatedTransferParams<Op>): Promise<R> {
    await delay(1000);

    const fakeTxId =
      this.request.from.chain === "Solana"
        ? encoding.b58.encode(new Uint8Array(64))
        : encoding.hex.encode(new Uint8Array(32));

    const fakeReceipt: SourceInitiatedTransferReceipt = {
      from: this.request.from.chain,
      to: this.request.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: [{ chain: sender.chain(), txid: fakeTxId }],
    };

    return fakeReceipt;
  }

  async *track(receipt: R, timeout?: number | undefined): AsyncGenerator<R, any, unknown> {
    // idt you want to use this?
    const fakeReceipt: CompletedTransferReceipt<
      any,
      typeof this.request.from.chain,
      typeof this.request.to.chain
    > = {
      ...(receipt as SourceInitiatedTransferReceipt),
      attestation: undefined,
      state: TransferState.DestinationFinalized,
    };
    yield fakeReceipt;
  }

  getDefaultOptions() {
    return {};
  }
}

(async function () {
  // Setup
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // get signers from local config
  const sendChain = wh.getChain("Solana");
  const destChain = wh.getChain("Ethereum");
  const sender = await getStuff(sendChain);
  const receiver = await getStuff(destChain);

  // create new resolver, overriding the default routes
  const resolver = wh.resolver([AutomaticFauxRoute]);

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
