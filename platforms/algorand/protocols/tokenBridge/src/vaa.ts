import { TokenBridge, encoding, keccak256, serialize } from "@wormhole-foundation/connect-sdk";
import {
  TransactionSignerPair,
  ALGO_VERIFY,
  ALGO_VERIFY_HASH,
  MAX_SIGS_PER_TXN,
  safeBigIntToNumber,
  decodeLocalState,
  StorageLogicSig,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  Algodv2,
  LogicSigAccount,
  OnApplicationComplete,
  SuggestedParams,
  Transaction,
  makeApplicationCallTxnFromObject,
  signLogicSigTransaction,
} from "algosdk";
import { maybeOptInTx } from "./assets";

type SubmitVAAState = {
  accounts: string[];
  txs: TransactionSignerPair[];
};

/**
 * Submits just the header of the VAA
 * @param client AlgodV2 client
 * @param bridgeId Application ID of the core bridge
 * @param vaa The VAA (just the header is used)
 * @param senderAddr Sending account address
 * @param appid Application ID
 * @returns Promise with current VAA state
 */
export async function submitVAAHeader(
  client: Algodv2,
  coreId: bigint,
  appid: bigint,
  vaa: TokenBridge.VAA,
  senderAddr: string,
): Promise<SubmitVAAState> {
  let txs: TransactionSignerPair[] = [];

  // Get storage acct for message ID
  const msgStorage = StorageLogicSig.forMessageId(appid, {
    chain: vaa.emitterChain,
    sequence: vaa.sequence,
    emitter: vaa.emitterAddress,
  });
  const { address: seqAddr, txs: seqOptInTxs } = await maybeOptInTx(
    client,
    senderAddr,
    appid,
    msgStorage,
  );
  txs.push(...seqOptInTxs);

  // Get storage account for Guardian set
  const gsStorage = StorageLogicSig.forGuardianSet(coreId, vaa.guardianSet);
  const { address: guardianAddr, txs: guardianOptInTxs } = await maybeOptInTx(
    client,
    senderAddr,
    coreId,
    gsStorage,
  );
  txs.push(...guardianOptInTxs);

  let accts: string[] = [seqAddr, guardianAddr];

  // Get the Guardian keys
  const keys: Uint8Array = await decodeLocalState(client, coreId, guardianAddr);

  const suggestedParams: SuggestedParams = await client.getTransactionParams().do();

  // We don't pass the entire payload in but instead just pass it pre-digested.  This gets around size
  // limitations with lsigs AND reduces the cost of the entire operation on a congested network by reducing the
  // bytes passed into the transaction
  // This is a 2 pass digest
  const digest = keccak256(vaa.hash);

  // How many signatures can we process in a single txn... we can do 6!
  // There are likely upwards of 19 signatures.  So, we ned to split things up
  const numSigs: number = vaa.signatures.length;
  const numTxns: number = Math.floor(numSigs / MAX_SIGS_PER_TXN) + 1;

  const SIG_LEN: number = 66;
  const GuardianKeyLen: number = 20;
  const verifySigArg: Uint8Array = encoding.bytes.encode("verifySigs");
  const lsa = new LogicSigAccount(ALGO_VERIFY);

  for (let nt = 0; nt < numTxns; nt++) {
    let sigs = vaa.signatures.slice(nt, nt + MAX_SIGS_PER_TXN);

    // The keyset is the set of Guardians that correspond
    // to the current set of signatures in this loop.
    // Each signature in 20 bytes and comes from decodeLocalState()
    let arraySize: number = sigs.length * GuardianKeyLen;
    let keySet: Uint8Array = new Uint8Array(arraySize);

    for (let i = 0; i < sigs.length; i++) {
      // The first byte of the sig is the relative index of that signature in the signatures array
      // Use that index to get the appropriate Guardian key
      const sig = sigs[i * SIG_LEN];
      const key = keys.slice(
        sig.guardianIndex * GuardianKeyLen + 1,
        (sig.guardianIndex + 1) * GuardianKeyLen + 1,
      );
      keySet.set(key, i * 20);
    }

    const appTxn = makeApplicationCallTxnFromObject({
      appArgs: [
        verifySigArg,
        encoding.bytes.concat(
          ...sigs.map((s) =>
            encoding.bytes.concat(new Uint8Array([s.guardianIndex]), s.signature.encode()),
          ),
        ),
        keySet,
        digest,
      ],
      accounts: accts,
      appIndex: safeBigIntToNumber(coreId),
      from: ALGO_VERIFY_HASH,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams,
    });
    appTxn.fee = 0;
    txs.push({
      tx: appTxn,
      signer: {
        addr: lsa.address(),
        signTxn: (txn: Transaction) => Promise.resolve(signLogicSigTransaction(txn, lsa).blob),
      },
    });
  }
  const appTxn = makeApplicationCallTxnFromObject({
    appArgs: [encoding.bytes.encode("verifyVAA"), serialize(vaa)],
    accounts: accts,
    appIndex: safeBigIntToNumber(coreId),
    from: senderAddr,
    onComplete: OnApplicationComplete.NoOpOC,
    suggestedParams,
  });
  appTxn.fee = appTxn.fee * (2 + numTxns); // Was 1
  txs.push({ tx: appTxn, signer: null });

  return { accounts: accts, txs };
}
