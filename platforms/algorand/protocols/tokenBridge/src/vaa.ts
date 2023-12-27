import {
  TokenBridge,
  encoding,
  keccak256,
  serialize,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import { TransactionSignerPair } from "@wormhole-foundation/connect-sdk-algorand";
import {
  ABIMethod,
  ABIType,
  Algodv2,
  LogicSigAccount,
  OnApplicationComplete,
  SuggestedParams,
  Transaction,
  encodeAddress,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  signLogicSigTransaction,
} from "algosdk";
import { decodeLocalState } from "./apps";
import { assetOptinCheck, optIn } from "./assets";
import { ALGO_VERIFY, ALGO_VERIFY_HASH, MAX_BITS, MAX_SIGS_PER_TXN } from "./constants";
import {
  hexToNativeAssetBigIntAlgorand,
  safeBigIntToNumber,
  textToHexString,
  textToUint8Array,
  uint8ArrayToHex,
} from "./utilities";

class SubmitVAAState {
  vaaMap: TokenBridge.VAA;
  accounts: string[];
  txs: TransactionSignerPair[];
  guardianAddr: string;

  constructor(
    vaaMap: TokenBridge.VAA,
    accounts: string[],
    txs: TransactionSignerPair[],
    guardianAddr: string,
  ) {
    this.vaaMap = vaaMap;
    this.accounts = accounts;
    this.txs = txs;
    this.guardianAddr = guardianAddr;
  }
}

/**
 * Submits just the header of the VAA
 * @param client AlgodV2 client
 * @param bridgeId Application ID of the core b * ridge
 * @param vaa The VAA (Just the header is used)
 * @param senderAddr Sending account address
 * @param appid Application ID
 * @returns Promise with current VAA state
 */
export async function submitVAAHeader(
  client: Algodv2,
  bridgeId: bigint,
  vaa: TokenBridge.VAA,
  senderAddr: string,
  appid: bigint,
): Promise<SubmitVAAState> {
  const index: number = vaa.guardianSet;
  const seq: bigint = vaa.sequence / BigInt(MAX_BITS);
  const em: string = vaa.emitterAddress.toString().slice(2);
  const chainId: string = BigInt(toChainId(vaa.emitterChain)).toString(16).padStart(4, "0");
  console.log(em, chainId);

  let txs: TransactionSignerPair[] = [];
  // "seqAddr"
  console.log("SEQY", seq / BigInt(MAX_BITS));
  const { addr: seqAddr, txs: seqOptInTxs } = await optIn(
    client,
    senderAddr,
    appid,
    seq / BigInt(MAX_BITS),
    chainId + em,
  );
  txs.push(...seqOptInTxs);

  const guardianPgmName = textToHexString("guardian");
  // And then the signatures to help us verify the vaa_s
  // "guardianAddr"
  const { addr: guardianAddr, txs: guardianOptInTxs } = await optIn(
    client,
    senderAddr,
    bridgeId,
    BigInt(index),
    guardianPgmName,
  );
  txs.push(...guardianOptInTxs);
  let accts: string[] = [seqAddr, guardianAddr];

  // When we attest for a new token, we need some place to store the info... later we will need to
  // mirror the other way as well
  const keys: Uint8Array = await decodeLocalState(client, bridgeId, guardianAddr);

  const params: SuggestedParams = await client.getTransactionParams().do();

  // We don't pass the entire payload in but instead just pass it pre-digested.  This gets around size
  // limitations with lsigs AND reduces the cost of the entire operation on a congested network by reducing the
  // bytes passed into the transaction
  // This is a 2 pass digest
  const digest = keccak256(vaa.hash);

  // How many signatures can we process in a single txn... we can do 6!
  // There are likely upwards of 19 signatures.  So, we ned to split things up
  const numSigs: number = vaa.signatures.length;
  let numTxns: number = Math.floor(numSigs / MAX_SIGS_PER_TXN) + 1;

  const SIG_LEN: number = 66;
  const GuardianKeyLen: number = 20;
  const verifySigArg: Uint8Array = textToUint8Array("verifySigs");
  const lsa = new LogicSigAccount(ALGO_VERIFY);

  for (let nt = 0; nt < numTxns; nt++) {
    let sigs = vaa.signatures.slice(nt, nt + MAX_SIGS_PER_TXN);

    // The keyset is the set of guardians that correspond
    // to the current set of signatures in this loop.
    // Each signature in 20 bytes and comes from decodeLocalState()
    let arraySize: number = sigs.length * GuardianKeyLen;
    let keySet: Uint8Array = new Uint8Array(arraySize);

    for (let i = 0; i < sigs.length; i++) {
      // The first byte of the sig is the relative index of that signature in the signatures array
      // Use that index to get the appropriate guardian key
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
      appIndex: safeBigIntToNumber(bridgeId),
      from: ALGO_VERIFY_HASH,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams: params,
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
    appArgs: [textToUint8Array("verifyVAA"), serialize(vaa)],
    accounts: accts,
    appIndex: safeBigIntToNumber(bridgeId),
    from: senderAddr,
    onComplete: OnApplicationComplete.NoOpOC,
    suggestedParams: params,
  });
  appTxn.fee = appTxn.fee * (2 + numTxns); // Was 1
  txs.push({ tx: appTxn, signer: null });

  return new SubmitVAAState(vaa, accts, txs, guardianAddr);
}

/**
 * Submits the VAA to the application
 * @param client AlgodV2 client
 * @param tokenBridgeId Application ID of the token bridge
 * @param bridgeId Application ID of the core bridge
 * @param vaa The VAA to be submitted
 * @param senderAddr Sending account address
 * @returns Promise with an array of TransactionSignerPair
 */
export async function _submitVAAAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  vaa: TokenBridge.VAA,
  senderAddr: string,
): Promise<TransactionSignerPair[]> {
  let sstate = await submitVAAHeader(client, bridgeId, vaa, senderAddr, tokenBridgeId);

  let parsedVAA = sstate.vaaMap;
  let accts = sstate.accounts;
  let txs = sstate.txs;

  // When we attest for a new token, we need some place to store the info... later we will need to
  // mirror the other way as well
  const meta = parsedVAA.payloadName;
  let chainAddr: string = "";
  if (meta === "AttestMeta" || meta === "Transfer" || meta === "TransferWithPayload") {
    if (parsedVAA.payload.token.chain !== "Algorand") {
      // "TokenBridge chainAddr"

      const chainId = BigInt(toChainId(parsedVAA.payload.token.chain));
      const result = await optIn(
        client,
        senderAddr,
        tokenBridgeId,
        chainId,
        parsedVAA.payload.token.address.toString().slice(2),
      );
      chainAddr = result.addr;
      txs.unshift(...result.txs);
    } else {
      const assetId = hexToNativeAssetBigIntAlgorand(
        parsedVAA.payload.token.address.toString().slice(2),
      );
      console.log("OTHER ASSET ID?", assetId);
      // "TokenBridge native chainAddr"
      const result = await optIn(
        client,
        senderAddr,
        tokenBridgeId,
        assetId,
        textToHexString("native"),
      );
      chainAddr = result.addr;
      txs.unshift(...result.txs);
    }
    accts.push(chainAddr);
  }

  const params: SuggestedParams = await client.getTransactionParams().do();

  if (meta === "AttestMeta") {
    let asset: Uint8Array = await decodeLocalState(client, tokenBridgeId, chainAddr);
    let foreignAssets: number[] = [];
    if (asset.length > 8) {
      const tmp = Buffer.from(asset.slice(0, 8));
      foreignAssets.push(safeBigIntToNumber(tmp.readBigUInt64BE(0)));
    }
    txs.push({
      tx: makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: chainAddr,
        amount: 100000,
        suggestedParams: params,
      }),
      signer: null,
    });
    let buf: Uint8Array = new Uint8Array(1);
    buf[0] = 0x01;
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [textToUint8Array("nop"), buf],
        appIndex: safeBigIntToNumber(tokenBridgeId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });

    buf = new Uint8Array(1);
    buf[0] = 0x02;
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [textToUint8Array("nop"), buf],
        appIndex: safeBigIntToNumber(tokenBridgeId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });

    txs.push({
      tx: makeApplicationCallTxnFromObject({
        accounts: accts,
        appArgs: [textToUint8Array("receiveAttest"), serialize(vaa)],
        appIndex: safeBigIntToNumber(tokenBridgeId),
        foreignAssets: foreignAssets,
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });
    txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 2; // QUESTIONBW: There are like 3 different ways of adjusting fees in various functions--this should be standardized
  }

  if (meta === "Transfer" || meta === "TransferWithPayload") {
    let foreignAssets: number[] = [];
    let assetId: number = 0;
    if (parsedVAA.payload.token.chain !== "Algorand") {
      let asset = await decodeLocalState(client, tokenBridgeId, chainAddr);
      if (asset.length > 8) {
        const tmp = Buffer.from(asset.slice(0, 8));
        assetId = safeBigIntToNumber(tmp.readBigUInt64BE(0));
      }
    } else {
      assetId = parseInt(parsedVAA.payload.token.address.toString().slice(2), 16);
    }

    console.log("ASSET ID", assetId);
    // The receiver needs to be optin in to receive the coins... Yeah, the relayer pays for this

    let aid = 0;
    let addr = "";

    if (parsedVAA.payload !== undefined) {
      if (parsedVAA.payload.to.chain === "Algorand" && meta === "TransferWithPayload") {
        aid = Number(
          hexToNativeAssetBigIntAlgorand(
            uint8ArrayToHex(parsedVAA.payload.to.address.toUint8Array()),
          ),
        );
        addr = getApplicationAddress(aid);
      } else {
        addr = encodeAddress(parsedVAA.payload.to.address.toUint8Array());
      }
    }

    if (assetId !== 0) {
      foreignAssets.push(assetId);
      if (!(await assetOptinCheck(client, BigInt(assetId), addr))) {
        if (senderAddr != addr) {
          throw new Error("cannot ASA optin for somebody else (asset " + assetId.toString() + ")");
        }

        txs.unshift({
          tx: makeAssetTransferTxnWithSuggestedParamsFromObject({
            amount: 0,
            assetIndex: assetId,
            from: senderAddr,
            suggestedParams: params,
            to: senderAddr,
          }),
          signer: null,
        });
      }
    }
    accts.push(addr);
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        accounts: accts,
        appArgs: [textToUint8Array("completeTransfer"), serialize(vaa)],
        appIndex: safeBigIntToNumber(tokenBridgeId),
        foreignAssets: foreignAssets,
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });

    // We need to cover the inner transactions
    if (
      parsedVAA.payloadName === "Transfer" &&
      parsedVAA.payload.fee !== undefined &&
      parsedVAA.payload.fee === 0n
    ) {
      txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 2;
    } else {
      txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 3;
    }

    if (meta === "TransferWithPayload") {
      txs[txs.length - 1].tx.appForeignApps = [aid];

      let m = ABIMethod.fromSignature("portal_transfer(byte[])byte[]");

      txs.push({
        tx: makeApplicationCallTxnFromObject({
          appArgs: [m.getSelector(), (m.args[0].type as ABIType).encode(serialize(vaa))],
          appIndex: aid,
          foreignAssets: foreignAssets,
          from: senderAddr,
          onComplete: OnApplicationComplete.NoOpOC,
          suggestedParams: params,
        }),
        signer: null,
      });
    }
  }

  return txs;
}
