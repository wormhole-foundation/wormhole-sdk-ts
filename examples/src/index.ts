import { CCTPTransfer, Wormhole } from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
//
import { TransferStuff, getStuff } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  // spongebob-patrick-from-here-to-there.jpg
  const src = "Avalanche";
  const dst = "Ethereum";

  // Grab chain Contexts
  const sendChain = wh.getChain(src);
  const rcvChain = wh.getChain(dst);

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getStuff(sendChain);
  const destination = await getStuff(rcvChain);

  await cctpTransfer(wh, source, destination);
  // await automaticTransfer(wh, source, destination);
  // await manualTransfer(wh, source, destination);
})();

async function cctpTransfer(
  wh: Wormhole,
  src: TransferStuff,
  dst: TransferStuff
) {
  if (src.chain.chain !== "Avalanche") {
    throw new Error("no plz");
  }
  // avax usdc addy
  const usdc = {
    chain: src.chain.chain,
    address: src.chain.platform.parseAddress(
      "0x5425890298aed601595a70AB815c96711a31Bc65"
    ),
  };

  const txid =
    "0xd63dcc451359f6e7ed33499bdd877b4c51a8eb26c4b300d4fdb5773793aebb04";
  const xfer = await CCTPTransfer.from(wh, {
    chain: src.chain.chain,
    txid: txid,
  });
  console.log(xfer);
  console.log(await xfer.fetchAttestation(1000));

  console.log(await xfer.completeTransfer(dst.signer));
}

async function automaticTransfer(
  wh: Wormhole,
  src: TransferStuff,
  dst: TransferStuff
) {
  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  const tt = await wh.tokenTransfer(
    "native",
    10000000n,
    src.address,
    dst.address,
    false
  );
  console.log(`Created token transfer object`);
  console.log(tt);

  // 1) Submit the transactions to the source chain, passing a signer to sign any txns
  const txids = await tt.initiateTransfer(src.signer);
  console.log(`Started transfer with txid: ${txids}`);

  // 2) wait for the VAA to be signed and ready
  const seq = await tt.fetchAttestation();
  console.log(`VAA is ready with seq: ${seq}`);

  // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  await tt.completeTransfer(dst.signer);
  console.log(`Transfer is complete!`);
}

async function manualTransfer(
  wh: Wormhole,
  src: TransferStuff,
  dst: TransferStuff
) {
  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  const tt = await wh.tokenTransfer(
    "native",
    10000000n,
    src.address,
    dst.address,
    false
  );
  console.log(`Created token transfer object`);
  console.log(tt);

  // //1) Submit the transactions to the source chain, passing a signer to sign any txns
  const txids = await tt.initiateTransfer(src.signer);
  console.log(`Started transfer with txid: ${txids}`);

  // // 2) wait for the VAA to be signed and ready
  // const seq = await tt.fetchAttestation();
  // console.log(`VAA is ready with seq: ${seq}`);

  // // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  // await tt.completeTransfer(dst.signer);
  // console.log(`Transfer is complete!`);
}
