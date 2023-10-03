import {
  Wormhole,
  TokenId,
  TokenTransfer,
  ChainName,
  Signer,
  toNative,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
//
import { TransferStuff, getStuff, waitLog } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [
    EvmPlatform,
    SolanaPlatform,
    CosmwasmPlatform,
  ]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Sei");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Choose your adventure
  await manualTokenTransfer(
    wh,
    "native",
    1_000_000_000_000n,
    source,
    destination
  );

  // const seiRpc = (await rcvChain.getRpc()) as CosmWasmClient;
  // const txid =
  //   "0x46838dff1151478b6673861077a998d46430e072a064430408c1d7f68de5dcec";
  // //"0xc7c6ee96c25b7d920c56e718783a314e16fdb2ed664a91d1ea71bd1ca809656e";
  // const [msg] = await sendChain.parseTransaction(txid);
  // const vaa = await wh.getVAABytes(msg.chain, msg.emitter, msg.sequence);
  // console.log(
  //   await seiRpc.queryContractSmart(
  //     "sei1jv5xw094mclanxt5emammy875qelf3v62u4tl4lp5nhte3w3s9ts9w9az2",
  //     {
  //       //transfer_info: { vaa: Buffer.from(vaa!).toString("base64") },
  //       wrapped_registry: {
  //         chain: 6,
  //         address: Buffer.from([
  //           0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 208, 10, 224, 132, 3, 185, 187,
  //           185, 18, 75, 179, 5, 192, 144, 88, 227, 44, 57, 164, 140,
  //         ]).toString("base64"),
  //       },
  //     }
  //   )
  // );
  // return;

  // await finishTransfer(wh, sendChain.chain, txid, destination.signer);

  // await automaticTokenTransfer(wh, "native", 100_000_000n, source, destination);
  // await automaticTokenTransferWithGasDropoff(
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
  // console.log("Getting Attestation");
  // const attestIds = await xfer.fetchAttestation();
  // console.log(`Got Attestation: `, attestIds);

  // // 3) redeem the VAA on the dest chain
  // console.log("Completing Transfer");
  // const destTxids = await xfer.completeTransfer(dst.signer);
  // console.log(`Completed Transfer: `, destTxids);
}

// If you've started a transfer but not completed it
// this method will complete the transfer given the source
// chain and transaction id
async function finishTransfer(
  wh: Wormhole,
  chain: ChainName,
  txid: string,
  signer: Signer
): Promise<void> {
  const xfer = await TokenTransfer.from(wh, { chain, txid });
  console.log(xfer);
  await xfer.completeTransfer(signer);
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
