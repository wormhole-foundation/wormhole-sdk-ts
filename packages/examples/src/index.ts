import { Wormhole, Context, Network } from "@wormhole-foundation/connect-sdk";
import { SolanaContext } from "@wormhole-foundation/connect-sdk-solana";
import { Transaction } from "@solana/web3.js";
import { EvmContext } from "@wormhole-foundation/connect-sdk-evm";
import { getSolSigner, getEthSigner } from "./helpers";

(async function () {
  const NETWORK = Network.TESTNET;
  const contexts = {
    [Context.SOLANA]: SolanaContext,
    [Context.EVM]: EvmContext,
  };

  const wh = new Wormhole(NETWORK, contexts);

  const solAcct = getSolSigner();
  const senderChain = "solana";
  const senderAddress = solAcct.publicKey.toBase58();

  console.log(senderAddress);

  const ethAcct = getEthSigner(wh.mustGetProvider("goerli"));
  const receiverChain = "goerli";
  const receiverAddress = ethAcct.address;

  // Prepare the transactions to start a transfer across chains
  const xfer: Transaction = await wh.startTransfer(
    "native",
    100n,
    senderChain,
    senderAddress,
    receiverChain,
    receiverAddress
  );

  console.log(xfer);
  // ...
})();
