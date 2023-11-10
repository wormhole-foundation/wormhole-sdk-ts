import {
  ChainName,
  Signer,
  TokenId,
  TokenTransfer,
  Wormhole,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { AptosPlatform } from "@wormhole-foundation/connect-sdk-aptos";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
//

import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";

import "@wormhole-foundation/connect-sdk-solana-core";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";

import "@wormhole-foundation/connect-sdk-cosmwasm-core";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";

import "@wormhole-foundation/connect-sdk-aptos-core";
import "@wormhole-foundation/connect-sdk-aptos-tokenbridge";

import { TransferStuff, getStuff, waitLog } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [
    EvmPlatform,
    SolanaPlatform,
    CosmwasmPlatform,
    AptosPlatform,
  ]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Aptos");
  const rcvChain = wh.getChain("Avalanche");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  const amt = normalizeAmount("0.01", sendChain.config.nativeTokenDecimals);

  // Choose your adventure
  await manualTokenTransfer(wh, "native", amt, source, destination);

  // await automaticTokenTransfer(wh, "native", 100_000_000n, source, destination);
  // await automaticTokenTransferWithGasDropoff(
  //   wh,
  //   "native",
  //   100_000_000n,
  //   source,
  //   destination,
  //   2_000_000_000_000n
  // );

  // const payload = encoding.toUint8Array("hai")
  // await manualTokenTransferWithPayload(wh, "native", 100_000_000n, source, destination, payload);
  // await automaticTokenTransferWithPayload(wh, "native", 100_000_000n, source, destination, payload);
  // await automaticTokenTransferWithPayloadAndGasDropoff(
  //   wh,
  //   "native",
  //   100_000_000n,
  //   source,
  //   destination,
  //   2_000_000_000_000n,
  //   payload
  // );

  // Or pick up where you left off given the source transaction
  //await finishTransfer(
  //  wh,
  //  sendChain.chain,
  //  "0xa7d82e92d703663280dab886a6b08f0102001f1248ac7844fa7f1c24f1cfa0cb",
  //  //"0x38a4a7b0ae1ebe4db6385163e900455686a745af1fb377190f76b245857bb7ed",
  //  destination.signer,
  //);
})();

async function tokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean,
  nativeGas?: bigint,
  payload?: Uint8Array,
) {
  const xfer = await wh.tokenTransfer(
    token,
    amount,
    src.address,
    dst.address,
    automatic,
    payload,
    nativeGas,
  );
  console.log(xfer);

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log("Starting transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started transfer: `, srcTxids);

  // If automatic, we're done
  if (automatic) return waitLog(xfer);

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log("Getting Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, destTxids);
}

// If you've started a transfer but not completed it
// this method will complete the transfer given the source
// chain and transaction id
async function finishTransfer(
  wh: Wormhole,
  chain: ChainName,
  txid: string,
  signer: Signer,
): Promise<void> {
  const xfer = await TokenTransfer.from(wh, { chain, txid });
  console.log(xfer);
  console.log(await xfer.completeTransfer(signer));
}

async function manualTokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
) {
  return tokenTransfer(wh, token, amount, src, dst, false);
}

async function automaticTokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
) {
  return tokenTransfer(wh, token, amount, src, dst, true);
}

async function automaticTokenTransferWithGasDropoff(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  nativeGas: bigint,
) {
  return tokenTransfer(wh, token, amount, src, dst, true, nativeGas);
}

async function manualTokenTransferWithPayload(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  payload: Uint8Array,
) {
  return tokenTransfer(wh, token, amount, src, dst, false, undefined, payload);
}

async function automaticTokenTransferWithPayload(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  payload: Uint8Array,
) {
  return tokenTransfer(wh, token, amount, src, dst, true, undefined, payload);
}

async function automaticTokenTransferWithPayloadAndGasDropoff(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  nativeGas: bigint,
  payload: Uint8Array,
) {
  return tokenTransfer(wh, token, amount, src, dst, true, nativeGas, payload);
}
