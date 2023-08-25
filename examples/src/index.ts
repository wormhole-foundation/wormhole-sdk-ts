import {
  Signer,
  ChainContext,
  CCTPTransfer,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
import { ethers } from "ethers";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { getEvmSigner } from "./helpers";
import { ChainAddress } from "@wormhole-foundation/sdk-definitions";

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
  const xfer = await CCTPTransfer.from(wh, {
    chain: src.chain.chain,
    txid: "0xd63dcc451359f6e7ed33499bdd877b4c51a8eb26c4b300d4fdb5773793aebb04",
  });
  console.log(xfer);
  console.log(await xfer.ready());

  // const xfer = await wh.cctpTransfer(
  //   usdc,
  //   10000n,
  //   src.address,
  //   dst.address,
  //   false
  // );
  // console.log(xfer);

  // const txids = await xfer.start(src.signer);
  // console.log(txids);
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
  const txids = await tt.start(src.signer);
  console.log(`Started transfer with txid: ${txids}`);

  // 2) wait for the VAA to be signed and ready
  const seq = await tt.ready();
  console.log(`VAA is ready with seq: ${seq}`);

  // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  await tt.finish(dst.signer);
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
  const txids = await tt.start(src.signer);
  console.log(`Started transfer with txid: ${txids}`);

  // // 2) wait for the VAA to be signed and ready
  // const seq = await tt.ready();
  // console.log(`VAA is ready with seq: ${seq}`);

  // // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  // await tt.finish(dst.signer);
  // console.log(`Transfer is complete!`);
}

type TransferStuff = {
  chain: ChainContext;
  signer: Signer;
  address: ChainAddress;
};

async function getStuff(chain: ChainContext): Promise<TransferStuff> {
  const signer = await getEvmSigner(
    chain.chain,
    chain.getRpc() as ethers.Provider
  );

  const address: ChainAddress = {
    chain: signer.chain(),
    address: chain.platform.parseAddress(signer.address()),
  };

  return { chain, signer, address };
}
