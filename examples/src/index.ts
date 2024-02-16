import {
  CONFIG,
  TokenBridge,
  Wormhole,
  amount,
  api,
  canonicalAddress,
  signSendWait,
} from "@wormhole-foundation/connect-sdk";

import { AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { SuiPlatform } from "@wormhole-foundation/connect-sdk-sui";

import "@wormhole-foundation/connect-sdk-algorand-tokenbridge";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";
import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-sui-tokenbridge";

import { getStuff } from "./helpers";

(async function () {
  // Setup
  const wh = new Wormhole("Mainnet", [
    EvmPlatform,
    SolanaPlatform,
    SuiPlatform,
    AlgorandPlatform,
    CosmwasmPlatform,
  ]);

  const suiCtx = wh.getChain("Sui");
  const suiTb = await suiCtx.getTokenBridge();
  const suiStuff = await getStuff(suiCtx);

  const solCtx = wh.getChain("Solana");
  const token = Wormhole.tokenId("Solana", "native");
  console.log(await solCtx.getBalance("9CC9Z3JrzxKoAHMHaDiFewpMNQeWv6ALJoVPZjSrdAaH", "native"));

  return;

  const solUsdc = Wormhole.tokenId("Solana", "6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU");
  if (!(await suiTb.hasWrappedAsset(solUsdc))) {
    // console.log("No wrapped asset, creating...");
    // const solCtx = wh.getChain("Solana");
    // const solStuff = await getStuff(solCtx);
    // const solTb = await solCtx.getTokenBridge();
    // console.log("Attesting on Solana");
    // const txs = await signSendWait(
    //   solCtx,
    //   solTb.createAttestation(solUsdc.address, solStuff.address.address),
    //   solStuff.signer,
    // );
    // console.log("Txids: ", txs);
    const txid =
      "4BXZxrLnAH1CzoQaiNfEAaUWGWuwQX73DvUDGAZUfunhvAxeVesXZHnPRgZX1amK2gKYcNTaABU4VCAvpUWhe8G";
    const vaa = await wh.getVaa(txid, "TokenBridge:AttestMeta", 60_000);
    if (!vaa) throw new Error("No VAA for attest");

    console.log("Got vaa: ", vaa);
    console.log(
      await signSendWait(
        suiCtx,
        suiTb.submitAttestation(vaa, suiStuff.address.address),
        suiStuff.signer,
      ),
    );
  }

  return;
  const usdc = Wormhole.tokenId(
    "Sui",
    "0xaf9ef585e2efd13321d0a2181e1c0715f9ba28ed052055d33a8b164f6c146a56::tusdt::TUSDT",
  );

  // get signers from local config
  console.log(await signSendWait(suiCtx, tb.createAttestation(usdc.address), sender.signer));
  return;

  const receiver = await getStuff(rcv);

  // Get a Token Bridge contract client on the source
  const sndTb = await snd.getTokenBridge();

  // Create a transaction stream for transfers
  const transfer = sndTb.transfer(
    sender.address.address,
    receiver.address,
    "native",
    amount.units(amount.parse("0.1", snd.config.nativeTokenDecimals)),
  );

  // Sign and send the transaction
  const txids = await signSendWait(snd, transfer, sender.signer);
  console.log("Sent: ", txids);

  // Get the wormhole message id from the transaction
  const [whm] = await snd.parseTransaction(txids[txids.length - 1]!.txid);
  console.log("Wormhole Messages: ", whm);

  // Get the VAA from the wormhole message id
  const vaa = await api.getVaaWithRetry(
    CONFIG["Testnet"].api,
    whm!,
    "TokenBridge:Transfer",
    60_000,
  );

  // Now get the token bridge on the redeem side
  const rcvTb = await rcv.getTokenBridge();

  // Create a transaction stream for redeeming
  const redeem = rcvTb.redeem(receiver.address.address, vaa!);

  // Sign and send the transaction
  const rcvTxids = await signSendWait(rcv, redeem, receiver.signer);
  console.log("Sent: ", rcvTxids);

  // Now get the token bridge on the redeem side
  const finished = await rcvTb.isTransferCompleted(vaa!);
  console.log("Transfer completed: ", finished);
})();
