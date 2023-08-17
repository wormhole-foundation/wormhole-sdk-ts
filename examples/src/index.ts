import { Wormhole, TokenTransfer } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm/src"; // TODO: why
import { getEvmSigner } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (testnet/mainnet/...) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  const sendChain = wh.getChain("Avalanche");
  const rcvChain = wh.getChain("Celo");

  // init some Signer objects from a local key
  const sendSigner = await getEvmSigner("Avalanche", sendChain.getRPC());
  const rcvSigner = await getEvmSigner("Celo", rcvChain.getRPC());

  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  const tt: TokenTransfer = wh.tokenTransfer(
    "native",
    100000n,
    sendSigner,
    rcvSigner
  );
  console.log(`Created token transfer object`);
  console.log(tt);

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  const txids = await tt.start();
  console.log(`Started transfer with txid: ${txids}`);

  // 2) wait for the VAA to be signed and ready
  const seq = await tt.ready();
  console.log(`VAA is ready with seq: ${seq}`);

  // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  await tt.finish(rcvSigner);
  console.log(`Transfer is complete!`);
})();
