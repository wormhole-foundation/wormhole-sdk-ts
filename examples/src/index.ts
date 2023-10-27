import {
  ChainName,
  Network,
  signSendWait,
  toNative,
  Wormhole,
} from "@wormhole-foundation/connect-sdk";
import {
  CosmwasmChain,
  CosmwasmPlatform,
} from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";

import { getStuff } from "./helpers";

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const network: Network = "Testnet";
  const wh = new Wormhole(network, [
    EvmPlatform,
    SolanaPlatform,
    CosmwasmPlatform,
  ]);

  const chain: ChainName = "Injective";
  const chainCtx = wh.getChain(chain) as CosmwasmChain;

  const { signer } = await getStuff(chainCtx);
  const walletAddr = toNative(chain, signer.address());

  const tb = await chainCtx.getTokenBridge();

  const recvChain = wh.getChain("Ethereum");
  const { address: receiver } = await getStuff(recvChain);

  console.log("creating, signing and sending transaction...");
  const xfer = tb.transfer(walletAddr, receiver, "native", 1_000_000n);
  const txids = await signSendWait(chainCtx, xfer, signer);
  console.log("Sent transactions: ", txids);
})();
