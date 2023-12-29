import { ChainId, toChainId } from "@wormhole-foundation/connect-sdk";
import {
  SEED_AMT,
  TransactionSignerPair,
  decodeLocalState,
  safeBigIntToNumber,
  varint,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  Algodv2,
  LogicSigAccount,
  SuggestedParams,
  Transaction,
  bigIntToBytes,
  getApplicationAddress,
  makeApplicationOptInTxnFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  modelsv2,
  signLogicSigTransaction,
} from "algosdk";
import { TransactionSet, WormholeWrappedInfo } from "./types";

const accountExistsCache = new Set<[bigint, string]>();

/**
 * Returns a boolean if the asset is wrapped
 * @param client Algodv2 client
 * @param tokenBridgeId Application ID of the token bridge
 * @param assetId Algorand asset index
 * @returns Promise with True if wrapped, False otherwise
 */
export async function getIsWrappedAssetOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  assetId: bigint,
): Promise<boolean> {
  if (assetId === BigInt(0)) {
    return false;
  }
  const tbAddr: string = getApplicationAddress(tokenBridgeId);
  const assetInfoResp = await client.getAssetByID(Number(assetId)).do();
  const asset = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
  const creatorAddr = asset.params.creator;
  const creatorAcctInfoResp = await client.accountInformation(creatorAddr).exclude("all").do();
  const creator = modelsv2.Account.from_obj_for_encoding(creatorAcctInfoResp);
  const isWrapped: boolean = creator?.authAddr === tbAddr;
  return isWrapped;
}

/**
 * Returns an origin chain and asset address on {originChain} for a provided Wormhole wrapped address
 * @param client Algodv2 client
 * @param tokenBridgeId Application ID of the token bridge
 * @param assetId Algorand asset index
 * @returns Wrapped Wormhole information structure
 */
export async function getOriginalAssetOffAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  assetId: bigint,
): Promise<WormholeWrappedInfo> {
  let retVal: WormholeWrappedInfo = {
    isWrapped: false,
    chainId: toChainId("Algorand"),
    assetAddress: new Uint8Array(),
  };
  retVal.isWrapped = await getIsWrappedAssetOnAlgorand(client, tokenBridgeId, assetId);
  if (!retVal.isWrapped) {
    retVal.assetAddress = bigIntToBytes(assetId, 32);
    return retVal;
  }
  const assetInfoResp = await client.getAssetByID(safeBigIntToNumber(assetId)).do();
  const assetInfo = modelsv2.Asset.from_obj_for_encoding(assetInfoResp);
  const lsa = assetInfo.params.creator;
  const decodedLocalState = await decodeLocalState(client, tokenBridgeId, lsa);
  retVal.chainId = Number(varint.decode(decodedLocalState, 92)) as ChainId;
  retVal.assetAddress = new Uint8Array(decodedLocalState.subarray(60, 60 + 32));
  return retVal;
}

/**
 * Checks to see if the account exists for the application
 * @param client An Algodv2 client
 * @param appId Application ID
 * @param acctAddr Account address to check
 * @returns True, if account exists for application, False otherwise
 */
export async function accountExists(
  client: Algodv2,
  appId: bigint,
  acctAddr: string,
): Promise<boolean> {
  if (accountExistsCache.has([appId, acctAddr])) return true;

  let ret = false;
  try {
    const acctInfoResp = await client.accountInformation(acctAddr).do();
    const acctInfo = modelsv2.Account.from_obj_for_encoding(acctInfoResp);
    const als = acctInfo.appsLocalState;
    if (!als) {
      return ret;
    }
    als.forEach((app) => {
      if (BigInt(app.id) === appId) {
        accountExistsCache.add([appId, acctAddr]);
        ret = true;
        return;
      }
    });
  } catch (e) {}
  return ret;
}

/**
 * Constructs opt in transactions
 * @param client An Algodv2 client
 * @param senderAddr Sender address
 * @param appId Application ID
 * @param storage StorageLogicSig
 * @returns Address and array of TransactionSignerPairs
 */
export async function maybeOptInTx(
  client: Algodv2,
  senderAddr: string,
  appId: bigint,
  storage: LogicSigAccount,
): Promise<TransactionSet> {
  const appAddr: string = getApplicationAddress(appId);

  const storageAddress = storage.address();

  let exists = false;
  try {
    // QUESTIONBW: Is this was you had in mind?
    exists = await accountExists(client, appId, storageAddress);
  } catch {}

  let txs: TransactionSignerPair[] = [];
  if (!exists) {
    const suggestedParams: SuggestedParams = await client.getTransactionParams().do();
    const seedTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: storageAddress,
      amount: SEED_AMT,
      suggestedParams,
    });
    seedTxn.fee = seedTxn.fee * 2;
    txs.push({ tx: seedTxn, signer: null });
    const optinTxn = makeApplicationOptInTxnFromObject({
      from: storageAddress,
      suggestedParams,
      appIndex: safeBigIntToNumber(appId),
      rekeyTo: appAddr,
    });
    optinTxn.fee = 0;
    txs.push({
      tx: optinTxn,
      signer: {
        addr: storage.address(),
        signTxn: (txn: Transaction) => Promise.resolve(signLogicSigTransaction(txn, storage).blob),
      },
    });
  }

  return {
    address: storageAddress,
    txs,
  };
}

/**
 * Checks if the asset has been opted in by the receiver
 * @param client Algodv2 client
 * @param asset Algorand asset index
 * @param receiver Account address
 * @returns Promise with True if the asset was opted in, False otherwise
 */
export async function assetOptinCheck(
  client: Algodv2,
  asset: bigint,
  receiver: string,
): Promise<boolean> {
  const acctInfoResp = await client.accountInformation(receiver).do();
  const acctInfo = modelsv2.Account.from_obj_for_encoding(acctInfoResp);
  const assets = acctInfo.assets;
  let ret = false;
  assets &&
    assets.forEach((a) => {
      const assetId = BigInt(a.assetId);
      if (assetId === asset) {
        ret = true;
        return;
      }
    });
  return ret;
}
