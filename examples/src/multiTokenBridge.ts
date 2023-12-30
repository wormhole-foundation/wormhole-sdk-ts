import {
  Chain,
  Network,
  Platform,
  TokenId,
  TokenTransfer,
  TokenTransferProtocol,
  TransferReceipt,
  Wormhole,
  isTokenId,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
import { TransferStuff, getStuff, waitLog } from "./helpers";
import { inspect } from "util";

// Import the platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand";

// Register the protocols
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-algorand-tokenbridge";

interface BridgingInputs {
  fromChain: Chain;
  asset: TokenId | "native";
  quantity: string;
  toChain: Chain;
  roundTrip?: boolean;
  recoverTxId?: string | undefined;
}

interface BridgingResult extends BridgingInputs {
  result: TransferReceipt<TokenTransferProtocol>;
}

(async function multipleBridges() {
  const scenarios: BridgingInputs[] = [
    // Example input set showing all parameters with recoverTxId as optional
    // {
    //   fromChain: "Avalanche",
    //   asset: Wormhole.chainAddress("Avalanche", "0x3bE4bce46442F5E85c47257145578E724E40cF97"),
    //   quantity: "0.0001",
    //   toChain: "Algorand",
    //   roundTrip: false,
    //   recoverTxId: "0xa4e0a2c1c994fe3298b5646dfd5ce92596dc1a589f42e241b7f07501a5a5a39f",
    // },
    {
      fromChain: "Algorand",
      asset: "native",
      quantity: "0.0001",
      toChain: "Solana",
      roundTrip: true,
    },
    {
      fromChain: "Algorand",
      asset: Wormhole.chainAddress("Algorand", "10458941"),
      quantity: "0.0001",
      toChain: "Solana",
      roundTrip: true,
    },
    {
      fromChain: "Solana",
      asset: "native",
      quantity: "0.0001",
      toChain: "Algorand",
      roundTrip: true,
    },
    {
      fromChain: "Solana",
      asset: Wormhole.chainAddress("Solana", "3Ftc5hTz9sG4huk79onufGiebJNDMZNL8HYgdMJ9E7JR"), // Wrapped AVAX
      quantity: "0.0001",
      toChain: "Algorand",
      roundTrip: true,
    },
  ];

  // Init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform, AlgorandPlatform]);

  const results: BridgingResult[] = await Promise.all(
    scenarios.map(async (scenario: BridgingInputs) => {
      // Grab chain Contexts -- these hold a reference to a cached rpc client
      const sendChain = wh.getChain(scenario.fromChain);
      const receiveChain = wh.getChain(scenario.toChain);

      // Get signer from local key
      // Anything that implements Signer interface (e.g. wrapper around web wallet) should also work
      const source = await getStuff(sendChain);
      const destination = await getStuff(receiveChain);

      // A TokenId is just a `{chain, address}` pair and an alias for ChainAddress
      // The `address` field must be a parsed address.
      // You can get a TokenId (or ChainAddress) prepared for you
      // by calling the static `chainAddress` method on the Wormhole class.
      // e.g.
      // const token = Wormhole.chainAddress("Avalanche", "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"); // TokenId<"Avalanche">
      // "Native" is a shortcut to allow transferring the native gas token
      const token = scenario.asset;

      // Normalized given token decimals later but can just pass bigints as base units
      // Note: The Token bridge will dedust past 8 decimals
      // this means any amount specified past that point will be returned
      // to the caller
      const amount = scenario.quantity;

      // Used to normalize the amount to account for the tokens decimals
      const decimals = isTokenId(scenario.asset)
        ? await wh.getDecimals(scenario.asset.chain, scenario.asset.address)
        : BigInt(sendChain.config.nativeTokenDecimals);

      // With automatic set to true, perform an automatic transfer. This will invoke a relayer
      // contract intermediary that knows to pick up the transfers
      // With automatic set to false, perform a manual transfer from source to destination
      // of the token
      // On the destination side, a wrapped version of the token will be minted
      // to the address specified in the transfer VAA
      const automatic = false;

      // The automatic relayer has the ability to deliver some native gas funds to the destination account
      // The amount specified for native gas will be swapped for the native gas token according
      // to the swap rate provided by the contract, denominated in native gas tokens
      const nativeGas = automatic ? "0.01" : undefined;

      // Set this to the transfer txid of the initiating transaction to recover a token transfer
      // and attempt to fetch details about its progress.
      const recoverTxid = scenario.recoverTxId;

      // Finally create and perform the transfer given the parameters set above
      const xfer = !recoverTxid
        ? // Perform the token transfer
          await tokenTransfer(
            wh,
            {
              token,
              amount: normalizeAmount(amount, decimals),
              source,
              destination,
              delivery: {
                automatic,
                nativeGas: nativeGas ? normalizeAmount(nativeGas, decimals) : undefined,
              },
            },
            scenario.roundTrip,
          )
        : // Recover the transfer from the originating txid
          await TokenTransfer.from(wh, {
            chain: source.chain.chain,
            txid: recoverTxid,
          });

      const receipt = await waitLog(wh, xfer);
      return { ...scenario, result: receipt };
    }),
  );

  console.log("Results: ", inspect(results, { depth: null }));
})();

async function tokenTransfer<N extends Network>(
  wh: Wormhole<N>,
  route: {
    token: TokenId | "native";
    amount: bigint;
    source: TransferStuff<N, Platform, Chain>;
    destination: TransferStuff<N, Platform, Chain>;
    delivery?: {
      automatic: boolean;
      nativeGas?: bigint;
    };
    payload?: Uint8Array;
  },
  roundTrip?: boolean,
): Promise<TokenTransfer<N>> {
  // Create a TokenTransfer object to track the state of
  // the transfer over time
  const xfer = await wh.tokenTransfer(
    route.token,
    route.amount,
    route.source.address,
    route.destination.address,
    route.delivery?.automatic ?? false,
    route.payload,
    route.delivery?.nativeGas,
  );

  const quote = await TokenTransfer.quoteTransfer(
    route.source.chain,
    route.destination.chain,
    xfer.transfer,
  );
  console.log("quote: ", inspect(quote, { depth: null }));

  if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
    throw "The amount requested is too low to cover the fee and any native gas requested.";

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(route.source.signer);
  console.log(`Started transfer: `, srcTxids);

  // If automatic, we're done
  if (route.delivery?.automatic) return xfer;

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(route.destination.signer);
  console.log(`Completed Transfer: `, destTxids);

  // No need to send back, dip
  if (!roundTrip) return xfer;

  const { destinationToken: token } = quote;
  return await tokenTransfer(wh, {
    ...route,
    token: token.token,
    amount: token.amount,
    source: route.destination,
    destination: route.source,
  });
}
