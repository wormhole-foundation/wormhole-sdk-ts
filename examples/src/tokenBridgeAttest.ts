///
// This file contains functionality that is also included in the
// ./examples/src/tokenBridge.ts with additional functions that allow
// the submittion of the VAA for with the Attestation Meta on both the
// Source and Destination chains.
//
// Read more about the "Attestation" VAAs here:
//  https://docs.wormhole.com/wormhole/explore-wormhole/vaa
//
// It is necessary to send the "Attestation" VAA the first time that a token
// is being bridged from Chain A to Chain B. This is because the Chain B
// does not have information about the token that is being bridged and it
// needs to know the `token_addres`, `token_chain`, `name`, `symbol`, and
// `decimals`.
//
// This information is first attested on Chain A and then the VAA should
// also be attested on any Chain B that the token is being bridged to.
//
// If the token is bridged to a new Chain B, the AttestMeta workflow should
// be used. When Chain A emmits an Attestation transaction the
// VAA<"AttestMeta"> can be processed on Chain B, which in turn needs
// to commit the VAA to the smart contract for the token bridge.
// After that, the token can be bridged from Chain A to Chain B.
//
//
// NOTE: Currently the Solana transaction on the smart contract for creating
// the attestation fails, but I haven't tested enough the reason why.
//

import {
  Wormhole,
  TokenId,
  TokenTransfer,
  ChainName,
  Signer,
  normalizeAmount,
} from "@wormhole-foundation/connect-sdk";
// Import the platform specific packages
import { EvmAddress, EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaAddress, SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { AlgorandAddress, AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand";
//

import "@wormhole-foundation/connect-sdk-evm-core";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-core";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-cosmwasm-core";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/connect-sdk-algorand";
import "@wormhole-foundation/connect-sdk-algorand-core";
import "@wormhole-foundation/connect-sdk-algorand-tokenbridge";

import { TransferStuff, getStuff, waitLog } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [
    AlgorandPlatform,
    EvmPlatform,
    SolanaPlatform,
    CosmwasmPlatform,
  ]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Algorand");

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  // Choose the Token you want to bridge or "native" for the native token
  const tk: TokenId = {
    chain: "Avalanche",
    address: new EvmAddress("0x8EBe82C117d9704E3207d3e86b2F62086fdfCA2A"),
  };

  // max 32 bytes
  const tokenDecimals = 6;
  const tokenSymbol = "USDC";
  const tokenName = "USDC";

  // ** Step 1: Create the Attestation on source that creates the VAA on the source chain
  await tokenAttestation(
    wh,
    tk,
    source,
    destination,
    tokenDecimals,
    tokenSymbol,
    tokenName,
    undefined,
  );
  // ** Step 2: If the previous step succeeded the token can be bridged
  const amt = normalizeAmount("0.000000000000000001", sendChain.config.nativeTokenDecimals);
  // const amt = normalizeAmount("0.01", sendChain.config.nativeTokenDecimals);

  // Choose your adventure
  // await manualTokenTransfer(wh, "native", amt, source, destination);
  await manualTokenTransfer(wh, tk, amt, source, destination);

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
  // await finishTransfer(
  //   wh,
  //   sendChain.chain,
  //   "0xaed2eb6361283dab84aeb3d211935458f971c38d1238d29b4c8bae63c76ede00",
  //   destination.signer,
  // );
})();

async function tokenAttestation(
  wh: Wormhole,
  token: TokenId | "native",
  src: TransferStuff,
  dst: TransferStuff,
  decimals: number,
  symbol: string,
  name: string,
  nativeGas?: bigint,
) {
  const xfer = await wh.tokenAttestation(
    token,
    src.address,
    dst.address,
    decimals,
    symbol,
    name,
    nativeGas,
  );

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log(">>> Starting Attestation Meta Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(">>> Started Attestation Meta Transfer with txhashes: ", srcTxids);

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log(">>> Getting 'AttestMeta' Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(">>> Got 'AttestMeta' Attestation : ", attestIds);
  const first = attestIds[0];
  console.log(">>> Attestation 'AttestMeta': ", first);

  // 3) redeem the VAA on the dest chain
  console.log(">>> Completing Attestation Transfer");
  const destTxids = await xfer.completeTransfer(dst.signer);
  console.log(">>> Completed Attestation Transfer with txhashes:", destTxids);
}

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

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  console.log(">>> Starting Token Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(">>> Started Token Transfer txhashes: ", srcTxids);

  // If automatic, we're done
  if (automatic) return waitLog(xfer);

  // 2) wait for the VAA to be signed and ready (not required for auto transfer)
  console.log(">>> Getting 'Transfer' Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(">>> Got 'Transfer' Attestation: ", attestIds);
  const first = attestIds[0];
  console.log(">>> Attestation 'Transfer' by: ", first);

  // 3) redeem the VAA on the dest chain
  console.log(">>> Completing Token Transfer");
  const destTxids = await xfer.completeTransfer(dst.signer);
  console.log(">>> Completed Token Transfer with txhashes: ", destTxids);
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
  await xfer.completeTransfer(signer);
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
