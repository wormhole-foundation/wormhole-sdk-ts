import { Wormhole, TokenTransfer } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm/src"; // TODO: why
import { getEvmSigner } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (testnet/mainnet/...) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  //// init some Signer objects from a local key
  const celoSigner = getEvmSigner("Celo");
  const ethSigner = getEvmSigner("Ethereum");

  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  // const tx: TokenTransfer = wh.tokenTransfer(
  //   "native",
  //   100n,
  //   celoSigner,
  //   ethSigner
  // );
  // console.log(`Created token transfer object: ${tx}`);

  // //// 1) Submit the transactions to the source chain, passing a signer to sign any txns
  // const txids = await tx.start();
  // console.log(`Started transfer with txid: ${txids}`);

  const tx = await TokenTransfer.fromTransaction(
    wh,
    "Celo",
    "0xb7677fabbe96e2caf10fdc14a3c971e60ff49458e83528c2594d87a7238af838"
  );

  console.log(tx);

  //// 2) wait for the VAA to be signed and ready
  //const seq = await tx.ready();
  //console.log(`VAA is ready with seq: ${seq}`);

  //// 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  //await tx.finish();
  //console.log(`Transfer is complete!`);
})();
