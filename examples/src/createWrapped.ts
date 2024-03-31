import { TokenId, Wormhole, load, signSendWait, wormhole } from "@wormhole-foundation/sdk";

import { inspect } from "util";
import { getSigner } from "./helpers/index.js";

(async function () {
  const wh = await wormhole("Testnet", load("Evm", "Solana"));

  // Original Token to Attest
  // const token: TokenId = Wormhole.chainAddress(
  //   "Solana",
  //   "9rU2jFrzA5zDDmt9yR7vEABvXCUNJ1YgGigdTb9oCaTv",
  // );
  const token: TokenId = Wormhole.chainAddress(
    "Avalanche",
    "0x3bE4bce46442F5E85c47257145578E724E40cF97",
  );

  // grab context and signer
  const origChain = wh.getChain(token.chain);
  const { signer: origSigner } = await getSigner(origChain);

  // Note: if the VAA is not produced before the attempt to retrieve it times out
  // you should set this value to the txid logged in the previous run
  let txid = undefined;
  // txid = "0x55127b9c8af46aaeea9ef28d8bf91e1aff920422fc1c9831285eb0f39ddca2fe";
  // txid = "FPNHIFFUZDVPT5SATZQZZ7DFGZMPCCHEFBCB5EZQJV4RRK3ZYTVA";
  // txid = "GWZU432ERFU3NES4MA7IAAP6DX73F5VRSSIWGJVC5JRHOH6UMWEQ";

  if (!txid) {
    // create attestation from origin chain, the same VAA
    // can be used across all chains
    const tb = await origChain.getTokenBridge();
    const attestTxns = tb.createAttestation(
      token.address,
      Wormhole.parseAddress(origSigner.chain(), origSigner.address()),
    );
    const txids = await signSendWait(origChain, attestTxns, origSigner);
    console.log("txids: ", inspect(txids, { depth: null }));
    txid = txids[0]!.txid;
    console.log("Created attestation (save this): ", txid);
  }

  // Get the wormhole message id from the transaction logs
  const msgs = await origChain.parseTransaction(txid);
  console.log(msgs);

  // Get the Signed VAA from the API
  const timeout = 60_000; // 60 seconds
  const vaa = await wh.getVaa(msgs[0]!, "TokenBridge:AttestMeta", timeout);
  if (!vaa) throw new Error("VAA not found after retries exhausted, try extending the timeout");

  console.log(vaa.payload.token.address);

  // Check if its attested and if not
  // submit the attestation to the token bridge on the
  // destination chain
  const chain = "Algorand";
  const destChain = wh.getChain(chain);
  const { signer } = await getSigner(destChain);

  // grab a ref to the token bridge
  const tb = await destChain.getTokenBridge();
  try {
    // try to get the wrapped version, an error here likely means
    // its not been attested
    const wrapped = await tb.getWrappedAsset(token);
    console.log("Already wrapped");
    return { chain, address: wrapped };
  } catch (e) {}

  // no wrapped asset, needs to be attested
  console.log("Attesting asset");
  await signSendWait(
    destChain,
    tb.submitAttestation(vaa, Wormhole.parseAddress(signer.chain(), signer.address())),
    signer,
  );

  async function waitForIt() {
    do {
      // check again
      try {
        const wrapped = await tb.getWrappedAsset(token);
        return { chain, address: wrapped };
      } catch (e) {
        console.error(e);
      }
      console.log("Waiting before checking again...");
      await new Promise((r) => setTimeout(r, 2000));
    } while (true);
  }

  console.log("Wrapped: ", await waitForIt());
})();
