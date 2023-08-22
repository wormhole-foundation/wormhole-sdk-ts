import {
  TokenTransfer,
  TransferState,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
import { ethers } from "ethers";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { getEvmSigner } from "./helpers";
import { ChainAddress } from "@wormhole-foundation/sdk-definitions";

(async function () {
  await automaticTransfer();
  // manualTransfer()
})();

async function automaticTransfer() {
  // init Wormhole object, passing config for which network
  // to use (testnet/mainnet/...) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  // init some Signer objects from a local key
  const sendChain = wh.getChain("Avalanche");
  const sendSigner = await getEvmSigner(
    sendChain.chain,
    sendChain.getRpc() as ethers.Provider
  );
  const sender: ChainAddress = {
    chain: sendSigner.chain(),
    address: sendChain.platform.parseAddress(sendSigner.address()),
  };

  const rcvChain = wh.getChain("Celo");
  const rcvSigner = await getEvmSigner(
    rcvChain.chain,
    rcvChain.getRpc() as ethers.Provider
  );
  const receiver: ChainAddress = {
    chain: rcvSigner.chain(),
    address: rcvChain.platform.parseAddress(rcvSigner.address()),
  };

  const tt = await TokenTransfer.from(wh, {
    chain: sendChain.chain,
    txid: "0xce9665abe063a8629967c7cb2dae9948d70a784be85c165bb5d7187fc5cea16f",
  });

  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  //const tt = await wh.tokenTransfer(
  //  "native",
  //  10000000n,
  //  sender,
  //  receiver,
  //  false
  //);
  //console.log(`Created token transfer object`);
  //console.log(tt);

  ////1) Submit the transactions to the source chain, passing a signer to sign any txns
  //const txids = await tt.start(sendSigner);
  //console.log(`Started transfer with txid: ${txids}`);

  // 2) wait for the VAA to be signed and ready
  const seq = await tt.ready();
  console.log(`VAA is ready with seq: ${seq}`);

  // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  await tt.finish(rcvSigner);
  console.log(`Transfer is complete!`);
}

async function manualTransfer() {
  // init Wormhole object, passing config for which network
  // to use (testnet/mainnet/...) and what Platforms to support
  const wh = new Wormhole("Testnet", [EvmPlatform]);

  // init some Signer objects from a local key
  const sendChain = wh.getChain("Avalanche");
  const sendSigner = await getEvmSigner(
    sendChain.chain,
    sendChain.getRpc() as ethers.Provider
  );
  const sender: ChainAddress = {
    chain: sendSigner.chain(),
    address: sendChain.platform.parseAddress(sendSigner.address()),
  };

  const rcvChain = wh.getChain("Celo");
  const rcvSigner = await getEvmSigner(
    rcvChain.chain,
    rcvChain.getRpc() as ethers.Provider
  );
  const receiver: ChainAddress = {
    chain: rcvSigner.chain(),
    address: rcvChain.platform.parseAddress(rcvSigner.address()),
  };

  // Create a TokenTransfer object that we can step through the process.
  // It holds a `state` field that is used to inform where in the process we are
  const tt = await wh.tokenTransfer(
    "native",
    10000000n,
    sender,
    receiver,
    false
  );
  console.log(`Created token transfer object`);
  console.log(tt);

  //1) Submit the transactions to the source chain, passing a signer to sign any txns
  const txids = await tt.start(sendSigner);
  console.log(`Started transfer with txid: ${txids}`);

  // 2) wait for the VAA to be signed and ready
  const seq = await tt.ready();
  console.log(`VAA is ready with seq: ${seq}`);

  // 3) redeem the VAA on the dest chain, passing a signer to sign any transactions
  await tt.finish(rcvSigner);
  console.log(`Transfer is complete!`);
}
