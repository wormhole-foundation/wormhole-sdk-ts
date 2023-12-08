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
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

// Register the protocols
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform, CosmwasmPlatform]);

  // Grab chain Contexts -- these hold a reference to a cached rpc client
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Solana");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Normalize the amount to account for the tokens decimals
  const amount = normalizeAmount("0.01", BigInt(sendChain.config.nativeTokenDecimals));

  // perform a manual transfer from source to destination of the native gas token
  // on the destination side, a wrapped version of the token will be minted
  // to the address specified in the transfer VAA

  //const xfer = await tokenTransfer(wh, { token: "native", amount, source, destination });
  //console.log(xfer);

  // Perform an automatic token transfer
  // const xfer = await tokenTransfer(wh, {
  //   token: "native",
  //   amount,
  //   source,
  //   destination,
  //   delivery: { automatic: true },
  // });
  // console.log(xfer);

  // Perform an automatic token transfer but also transfer some naive
  // gas to the receiver on the destination chain
  const xfer = await tokenTransfer(wh, {
    token: "native",
    amount,
    source,
    destination,
    delivery: {
      automatic: true,
      nativeGas: normalizeAmount("0.01", BigInt(sendChain.config.nativeTokenDecimals)),
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

  if (!roundTrip) {
    return xfer;
  }

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

// async function automaticTokenTransfer(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true);
// }
//
// async function automaticTokenTransferWithGasDropoff(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   nativeGas: bigint,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true, nativeGas);
// }
//
// async function manualTokenTransferWithPayload(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   payload: Uint8Array,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, false, undefined, payload);
// }
//
// async function automaticTokenTransferWithPayload(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   payload: Uint8Array,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true, undefined, payload);
// }
//
// async function automaticTokenTransferWithPayloadAndGasDropoff(
//   wh: Wormhole,
//   token: TokenId | "native",
//   amount: bigint,
//   src: TransferStuff,
//   dst: TransferStuff,
//   nativeGas: bigint,
//   payload: Uint8Array,
// ) {
//   return tokenTransfer(wh, token, amount, src, dst, true, nativeGas, payload);
// }
