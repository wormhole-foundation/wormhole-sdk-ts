import {
  Chain,
  Network,
  Platform,
  TokenId,
  TokenTransfer,
  Wormhole,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
import { TransferStuff, getStuff, waitLog } from "./helpers";

// Import the platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

// Register the protocols
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // Grab chain Contexts -- these hold a reference to a cached rpc client
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Solana");

  // TODO: Solana _slow_ to show up if ever?
  // await waitLog(
  //   await TokenTransfer.from(wh, {
  //     chain: "Avalanche",
  //     txid: "0x6405d3454c82e0f877350967a191f80e44ad1a30846fe46c52624c487c4c9b72",
  //   }),
  // );

  //const token = "native"
  const token = await wh.getWrappedAsset("Avalanche", await rcvChain.getNativeWrappedTokenId());
  // const token = Wormhole.chainAddress(
  //   sendChain.chain,
  //   "3Ftc5hTz9sG4huk79onufGiebJNDMZNL8HYgdMJ9E7JR",
  // );

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Normalize the amount to account for the tokens decimals
  const decimals =
    typeof token === "string" && token === "native"
      ? BigInt(sendChain.config.nativeTokenDecimals)
      : await wh.getDecimals(token.chain, token.address);

  const amount = normalizeAmount("0.01", decimals);

  //
  // Manual Transfer
  //
  // perform a manual transfer from source to destination of the native gas token
  // on the destination side, a wrapped version of the token will be minted
  // to the address specified in the transfer VAA
  //const xfer = await tokenTransfer(wh, { token: "native", amount, source, destination });
  //console.log(xfer);

  //
  // Automatic Transfer
  //

  // The automatic relayer has the ability to deliver some native gas funds to the destination account
  // The amount specified for native gas will be swapped for the native gas token according
  // to the swap rate provided by the contract, denominated in native gas tokens
  const nativeGas = normalizeAmount("0.01", decimals);

  // Perform an automatic token transfer
  // set the native gas variable above to also transfer some native
  // gas to the receiver on the destination chain
  const xfer = await tokenTransfer(wh, {
    token,
    amount,
    source,
    destination,
    delivery: {
      automatic: true,
      nativeGas,
    },
  });
  console.log(xfer);
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
  // Create a TokenTransfer obj to track the state over time
  const xfer = await wh.tokenTransfer(
    route.token,
    route.amount,
    route.source.address,
    route.destination.address,
    route.delivery?.automatic ?? false,
    route.payload,
    route.delivery?.nativeGas,
  );

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(route.source.signer);
  console.log(`Started transfer: `, srcTxids);

  // If automatic, we're done
  if (route.delivery?.automatic) {
    await waitLog(xfer);
    return xfer;
  }

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(route.destination.signer);
  console.log(`Completed Transfer: `, destTxids);

  if (!roundTrip) return xfer;

  // We're sending _back_ to the origin

  // We can look up the destination asset for this transfer given the context of
  // the sending chain and token and destination chain
  const destToken = await TokenTransfer.lookupDestinationToken(wh, xfer.transfer);
  console.log(destToken);

  // The wrapped token may have a different number of decimals
  // to make things easy, lets just send the amount from the VAA back
  const amount = xfer.vaas![0]!.vaa!.payload.token.amount;
  return await tokenTransfer(wh, {
    ...route,
    token: destToken,
    amount,
    source: route.destination,
    destination: route.source,
  });
}
