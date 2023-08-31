import { Wormhole } from "@wormhole-foundation/connect-sdk";
// TODO: should we re-export the things they need? should we rename the underlying packages?
import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import {
  SolanaChain,
  SolanaPlatform,
} from "@wormhole-foundation/connect-sdk-solana";
//
import { TransferStuff, getStuff, waitLog } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform, SolanaPlatform]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Solana");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Manual Token Bridge Transfer
  await tokenTransfer(wh, "native", 100_000_000n, source, destination, false);

  // Automatic Token Bridge Transfer
  // await tokenTransfer(
  //   wh,
  //   "native",
  //   100_000_000n,
  //   source,
  //   destination,
  //   2_000_000_000_000n
  // );

  // const payload = new Uint8Array(Buffer.from("hai"))
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
})();

async function tokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  automatic: boolean,
  nativeGas?: bigint,
  payload?: Uint8Array
) {
  // Bit of (temporary) hackery until solana contracts support being
  // sent a VAA with the primary address
  if (dst.chain.chain === "Solana") {
    // Overwrite the dest address with the ATA
    dst.address = {
      chain: dst.address.chain,
      address: await (<SolanaChain>dst.chain).getTokenAccount(
        token !== "native"
          ? token
          : await (await src.chain.getTokenBridge()).getWrappedNative(),
        dst.address.address.toUniversalAddress()
      ),
    };
  }

  const xfer = await wh.tokenTransfer(
    token,
    amount,
    src.address,
    dst.address,
    automatic,
    payload,
    nativeGas
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
  const attestIds = await xfer.fetchAttestation();
  console.log(`Got Attestation: `, attestIds);

  // 3) redeem the VAA on the dest chain
  console.log("Completing Transfer");
  const destTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, destTxids);
}

async function manualTokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff
) {
  return tokenTransfer(wh, token, amount, src, dst, false);
}

async function automaticTokenTransfer(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff
) {
  return tokenTransfer(wh, token, amount, src, dst, true);
}

async function automaticTokenTransferWithGasDropoff(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  nativeGas: bigint
) {
  return tokenTransfer(wh, token, amount, src, dst, true, nativeGas);
}

async function manualTokenTransferWithPayload(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  payload: Uint8Array
) {
  return tokenTransfer(wh, token, amount, src, dst, false, undefined, payload);
}

async function automaticTokenTransferWithPayload(
  wh: Wormhole,
  token: TokenId | "native",
  amount: bigint,
  src: TransferStuff,
  dst: TransferStuff,
  payload: Uint8Array
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
  payload: Uint8Array
) {
  return tokenTransfer(wh, token, amount, src, dst, true, nativeGas, payload);
}
