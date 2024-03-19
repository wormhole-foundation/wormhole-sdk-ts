import { Wormhole, wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";

import { EvmNtt } from "@wormhole-foundation/sdk-evm-ntt";

import { amount, signSendWait } from "@wormhole-foundation/sdk";
import { getSigner } from "./helpers/index.js";

(async function () {
  const wh = await wormhole("Testnet", [evm, solana]);

  const snd = wh.getChain("Sepolia");
  const rcv = wh.getChain("Solana");

  const sender = await getSigner(snd);
  const receiver = await getSigner(rcv);

  const ntt = await EvmNtt.fromRpc(await snd.getRpc(), wh.config.chains);
  console.log(ntt);

  const token = Wormhole.parseAddress(snd.chain, "0x1d30E78B7C7fbbcef87ae6e97B5389b2e470CA4a");
  const xfer = ntt.transfer(sender.address.address, token, 1n, receiver.address);
  const txids = await signSendWait(snd, xfer, sender.signer);
  console.log(txids);
})();
