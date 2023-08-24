import {
  Signer,
  ChainContext,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
import { ethers } from "ethers";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { getEvmSigner } from "./helpers";
import { ChainAddress } from "@wormhole-foundation/sdk-definitions";
import {
  ChainName,
  PlatformName,
  chainIdToChain,
  chainToPlatform,
  isChain,
  isPlatform,
} from "@wormhole-foundation/sdk-base";

type TransferStuff = {
  chain: ChainContext;
  signer: Signer;
  address: ChainAddress;
};

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  const fuck: PlatformName | ChainName = "Evm";
  const platform: PlatformName = isChain(fuck)
    ? chainToPlatform.get(fuck)!
    : fuck;

  console.log(platform);

  // spongebob-patrick-from-here-to-there.jpg
  const src = "Avalanche";
  const dst = "Polygon";

  // Grab chain Contexts
  const sendChain = wh.getChain(src);
  const rcvChain = wh.getChain(dst);

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const [sendSigner, sender] = await getSigner(sendChain);
  const source: TransferStuff = {
    chain: sendChain,
    signer: sendSigner,
    address: sender,
  };

  const [rcvSigner, receiver] = await getSigner(rcvChain);
  const destination: TransferStuff = {
    chain: rcvChain,
    signer: rcvSigner,
    address: receiver,
  };

  // await cctpTransfer(wh, source, destination);
  // await automaticTransfer(wh, source, destination);
  await manualTransfer(wh, source, destination);
})();

async function cctpTransfer(
  wh: Wormhole,
  src: TransferStuff,
  dst: TransferStuff
) {
  const xfer = await wh.cctpTransfer(
    {
      chain: src.chain.chain,
      address: src.chain.platform.parseAddress(
        "0x5425890298aed601595a70AB815c96711a31Bc65"
      ),
    },
    100000n,
    src.address,
    dst.address,
    false
  );
  console.log(xfer);

  const txids = await xfer.start(src.signer);
  console.log(txids);
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

async function getSigner(chain: ChainContext): Promise<[Signer, ChainAddress]> {
  const signer = await getEvmSigner(
    chain.chain,
    chain.getRpc() as ethers.Provider
  );

  const addy: ChainAddress = {
    chain: signer.chain(),
    address: chain.platform.parseAddress(signer.address()),
  };

  return [signer, addy];
}
