import {
  Algodv2,
  OnApplicationComplete,
  SuggestedParams,
  bigIntToBytes,
  decodeAddress,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  modelsv2,
} from "algosdk";
import { calcLogicSigAccount, getEmitterAddressAlgorand } from "./apps";
import { BITS_PER_KEY, MAX_BITS } from "./constants";
import {
  safeBigIntToNumber,
  textToHexString,
  textToUint8Array,
  uint8ArrayToHex,
} from "./utilities";
import { _parseVAAAlgorand, _submitVAAAlgorand } from "./_vaa";
import { assetOptinCheck, optIn } from "./assets";
import { Chain, UniversalAddress, toChainId } from "@wormhole-foundation/connect-sdk";
import { TransactionSignerPair } from "@wormhole-foundation/connect-sdk-algorand";

/**
 * This function is used to check if a VAA has been redeemed by looking at a specific bit
 * @param client AlgodV2 client
 * @param appId Application Id
 * @param addr Wallet address. Someone has to pay for this
 * @param seq The sequence number of the redemption
 * @returns True, if the bit was set and VAA was redeemed, False otherwise
 */
async function checkBitsSet(
  client: Algodv2,
  appId: bigint,
  addr: string,
  seq: bigint,
): Promise<boolean> {
  let retval: boolean = false;
  let appState: modelsv2.TealKeyValue[] | undefined;
  const acctInfoResp = await client.accountInformation(addr).do();
  const acctInfo = modelsv2.Account.from_obj_for_encoding(acctInfoResp);
  const als = acctInfo.appsLocalState;
  als &&
    als.forEach((app) => {
      if (BigInt(app.id) === appId) {
        appState = app.keyValue;
      }
    });
  if (appState?.length === 0) {
    return retval;
  }

  const BIG_MAX_BITS: bigint = BigInt(MAX_BITS);
  const BIG_EIGHT: bigint = BigInt(8);
  // Start on a MAX_BITS boundary
  const start: bigint = (seq / BIG_MAX_BITS) * BIG_MAX_BITS;
  // beg should be in the range [0..MAX_BITS]
  const beg: number = safeBigIntToNumber(seq - start);
  // s should be in the range [0..15]
  const s: number = Math.floor(beg / BITS_PER_KEY);
  const b: number = Math.floor((beg - s * BITS_PER_KEY) / 8);

  const key = Buffer.from(bigIntToBytes(s, 1)).toString("base64");
  appState?.forEach((kv) => {
    if (kv.key === key) {
      const v = Buffer.from(kv.value.bytes, "base64");
      const bt = 1 << safeBigIntToNumber(seq % BIG_EIGHT);
      retval = (v[b]! & bt) != 0; // Added non-null assertion
      return;
    }
  });
  return retval;
}

/**
 * Returns true if this transfer was completed on Algorand
 * @param client AlgodV2 client
 * @param appId Most likely the Token bridge ID
 * @param signedVAA VAA to check
 * @returns True if VAA has been redeemed, False otherwise
 */
export async function getIsTransferCompletedAlgorand(
  client: Algodv2,
  appId: bigint,
  signedVAA: Uint8Array,
): Promise<boolean> {
  const parsedVAA = _parseVAAAlgorand(signedVAA); // TODO: rip this out and look for deserialize('TokenBridge:Attestation', bytes)
  const seq: bigint = parsedVAA.sequence;
  const chainRaw: string = parsedVAA.chainRaw; // this needs to be a hex string
  const em: string = parsedVAA.emitter; // this needs to be a hex string

  const { doesExist, lsa } = await calcLogicSigAccount(
    client,
    appId,
    seq / BigInt(MAX_BITS),
    chainRaw + em,
  );
  if (!doesExist) {
    return false;
  }
  const seqAddr = lsa.address();
  const retVal: boolean = await checkBitsSet(client, appId, seqAddr, seq);
  return retVal;
}

/**
 * Return the message fee for the core bridge
 * @param client An Algodv2 client
 * @param bridgeId The application ID of the core bridge
 * @returns Promise with the message fee for the core bridge
 */
export async function getMessageFee(client: Algodv2, bridgeId: bigint): Promise<bigint> {
  const applInfoResp: Record<string, any> = await client
    .getApplicationByID(safeBigIntToNumber(bridgeId))
    .do();
  const appInfo = modelsv2.Application.from_obj_for_encoding(applInfoResp);
  const globalState = appInfo.params.globalState;
  const key: string = Buffer.from("MessageFee", "binary").toString("base64");
  let ret = BigInt(0);
  globalState &&
    globalState.forEach((kv) => {
      if (kv.key === key) {
        ret = BigInt(kv.value.uint);
        return;
      }
    });
  console.log("Message Fee: ", ret);
  return ret;
}

/**
 * Attest an already created asset
 * If you create a new asset on algorand and want to transfer it elsewhere,
 * you create an attestation for it on algorand, pass that vaa to the target chain,
 * submit it, and then you can transfer from Algorand to that target chain
 * @param client An Algodv2 client
 * @param tokenBridgeId The ID of the token bridge
 * @param senderAcct The account paying fees
 * @param assetId The asset index
 * @returns Transaction ID
 */
export async function attestFromAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  assetId: bigint,
): Promise<TransactionSignerPair[]> {
  const tbAddr: string = getApplicationAddress(tokenBridgeId);
  const decTbAddr: Uint8Array = decodeAddress(tbAddr).publicKey;
  const aa: string = uint8ArrayToHex(decTbAddr);
  const txs: TransactionSignerPair[] = [];
  // "attestFromAlgorand::emitterAddr"
  const { addr: emitterAddr, txs: emitterOptInTxs } = await optIn(
    client,
    senderAddr,
    bridgeId,
    BigInt(0),
    aa,
  );
  txs.push(...emitterOptInTxs);

  let creatorAddr = "";
  let creatorAcctInfo;
  const bPgmName: Uint8Array = textToUint8Array("attestToken");

  if (assetId !== BigInt(0)) {
    const assetInfoResp = await client.getAssetByID(safeBigIntToNumber(assetId)).do();
    const assetInfo = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
    const creatorAcctInfoResp = await client.accountInformation(assetInfo.params.creator).do();
    creatorAcctInfo = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
    if (creatorAcctInfo.authAddr === tbAddr) {
      throw new Error("Cannot re-attest wormhole assets");
    }
  }
  const result = await optIn(client, senderAddr, tokenBridgeId, assetId, textToHexString("native"));
  creatorAddr = result.addr;
  txs.push(...result.txs);

  const suggParams: SuggestedParams = await client.getTransactionParams().do();

  const firstTxn = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: [textToUint8Array("nop")],
    suggestedParams: suggParams,
  });
  txs.push({ tx: firstTxn, signer: null });

  const mfee = await getMessageFee(client, bridgeId);
  if (mfee > BigInt(0)) {
    const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      suggestedParams: suggParams,
      to: getApplicationAddress(tokenBridgeId),
      amount: mfee,
    });
    txs.push({ tx: feeTxn, signer: null });
  }

  let accts: string[] = [emitterAddr, creatorAddr, getApplicationAddress(bridgeId)];

  if (creatorAcctInfo) {
    accts.push(creatorAcctInfo.address);
  }

  let appTxn = makeApplicationCallTxnFromObject({
    appArgs: [bPgmName, bigIntToBytes(assetId, 8)],
    accounts: accts,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    foreignApps: [safeBigIntToNumber(bridgeId)],
    foreignAssets: [safeBigIntToNumber(assetId)],
    from: senderAddr,
    onComplete: OnApplicationComplete.NoOpOC,
    suggestedParams: suggParams,
  });
  if (mfee > BigInt(0)) {
    appTxn.fee *= 3;
  } else {
    appTxn.fee *= 2;
  }
  txs.push({ tx: appTxn, signer: null });

  return txs;
}

/**
 * Submits the VAA to Algorand
 * @param client AlgodV2 client
 * @param tokenBridgeId Token bridge ID
 * @param bridgeId Core bridge ID
 * @param vaa The VAA to be redeemed
 * @param acct Sending account
 * @returns Promise with array of TransactionSignerPair
 */
export async function redeemOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  vaa: Uint8Array,
  senderAddr: string,
): Promise<TransactionSignerPair[]> {
  return await _submitVAAAlgorand(client, tokenBridgeId, bridgeId, vaa, senderAddr);
}

/**
 * Transfers an asset from Algorand to a receiver on another chain
 * @param client AlgodV2 client
 * @param tokenBridgeId Application ID of the token bridge
 * @param bridgeId Application ID of the core bridge
 * @param senderAddr Sending account
 * @param assetId Asset index
 * @param qty Quantity to transfer
 * @param receiver Receiving account
 * @param chain Reeiving chain
 * @param fee Transfer fee
 * @param payload payload for payload3 transfers
 * @returns Promise with array of TransactionSignerPair
 */
export async function transferFromAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  assetId: bigint,
  qty: bigint,
  receiver: UniversalAddress,
  chain: Chain,
  fee: bigint,
  payload: Uint8Array | null = null,
): Promise<TransactionSignerPair[]> {
  const recipientChainId = toChainId(chain);
  const tokenAddr: string = getApplicationAddress(tokenBridgeId);
  const applAddr: string = getEmitterAddressAlgorand(tokenBridgeId);
  const txs: TransactionSignerPair[] = [];
  // "transferAsset"
  const { addr: emitterAddr, txs: emitterOptInTxs } = await optIn(
    client,
    senderAddr,
    bridgeId,
    BigInt(0),
    applAddr,
  );
  txs.push(...emitterOptInTxs);
  let creator = "";
  let creatorAcct: modelsv2.Account | undefined;
  let wormhole: boolean = false;
  if (assetId !== BigInt(0)) {
    const assetInfoResp: Record<string, any> = await client
      .getAssetByID(safeBigIntToNumber(assetId))
      .do();
    const asset = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
    creator = asset.params.creator;
    const creatorAcctInfoResp = await client.accountInformation(creator).do();
    creatorAcct = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
    const authAddr = creatorAcct.authAddr;
    if (authAddr === tokenAddr) {
      wormhole = true;
    }
  }

  const params: SuggestedParams = await client.getTransactionParams().do();
  const msgFee: bigint = await getMessageFee(client, bridgeId);
  if (msgFee > 0) {
    const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      suggestedParams: params,
      to: getApplicationAddress(tokenBridgeId),
      amount: msgFee,
    });
    txs.push({ tx: payTxn, signer: null });
  }
  if (!wormhole) {
    const bNat = Buffer.from("native", "binary").toString("hex");
    // "creator"
    const result = await optIn(client, senderAddr, tokenBridgeId, assetId, bNat);
    creator = result.addr;
    txs.push(...result.txs);
  }

  if (assetId !== BigInt(0) && !(await assetOptinCheck(client, assetId, creator))) {
    // Looks like we need to optin
    const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: creator,
      amount: 100000,
      suggestedParams: params,
    });
    txs.push({ tx: payTxn, signer: null });
    // The tokenid app needs to do the optin since it has signature authority
    const bOptin: Uint8Array = textToUint8Array("optin");
    let txn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(tokenBridgeId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [bOptin, bigIntToBytes(assetId, 8)],
      foreignAssets: [safeBigIntToNumber(assetId)],
      accounts: [creator],
      suggestedParams: params,
    });
    txn.fee *= 2;
    txs.push({ tx: txn, signer: null });
  }
  const t = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: [textToUint8Array("nop")],
    suggestedParams: params,
  });
  txs.push({ tx: t, signer: null });

  let accounts: string[] = [];
  if (assetId === BigInt(0)) {
    const t = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: creator,
      amount: qty,
      suggestedParams: params,
    });
    txs.push({ tx: t, signer: null });
    accounts = [emitterAddr, creator, creator];
  } else {
    const t = makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: creator,
      suggestedParams: params,
      amount: qty,
      assetIndex: safeBigIntToNumber(assetId),
    });
    txs.push({ tx: t, signer: null });

    accounts = creatorAcct?.address
      ? [emitterAddr, creator, creatorAcct.address]
      : [emitterAddr, creator];
  }
  console.log("transferFromAlgorand receiver: ", receiver);
  const receiverBytes = new Uint8Array(receiver.toUint8Array());
  console.log("receiverBytes: ", receiverBytes);

  let args = [
    textToUint8Array("sendTransfer"),
    bigIntToBytes(assetId, 8),
    bigIntToBytes(qty, 8),
    receiverBytes,
    bigIntToBytes(recipientChainId, 8),
    bigIntToBytes(fee, 8),
  ];
  console.log("Args: ", args);
  if (payload !== null) {
    args.push(payload);
  }
  let acTxn = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: args,
    foreignApps: [safeBigIntToNumber(bridgeId)],
    foreignAssets: [safeBigIntToNumber(assetId)],
    accounts: accounts,
    suggestedParams: params,
  });
  acTxn.fee *= 2;
  txs.push({ tx: acTxn, signer: null });
  return txs;
}

// TODO: Need to figure out what to do with this
export async function createWrappedOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  attestVAA: Uint8Array,
): Promise<TransactionSignerPair[]> {
  return await _submitVAAAlgorand(client, tokenBridgeId, bridgeId, attestVAA, senderAddr);
}
