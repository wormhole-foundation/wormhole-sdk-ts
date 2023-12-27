import { Chain, ChainId, toChainId } from "@wormhole-foundation/connect-sdk";
import {
  CHAIN_ID_ALGORAND,
  TransactionSignerPair,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  Algodv2,
  Transaction,
  bigIntToBytes,
  bytesToBigInt,
  getApplicationAddress,
  makeApplicationOptInTxnFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  signLogicSigTransaction,
  modelsv2
} from "algosdk";
import { OptInResult, WormholeWrappedInfo } from "./types";
import { safeBigIntToNumber } from "./utilities";
import { calcLogicSigAccount, decodeLocalState } from "./apps";
import { hex } from "@wormhole-foundation/sdk-base/src/utils/encoding";
import { SEED_AMT } from "./constants";

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
    chainId: CHAIN_ID_ALGORAND,
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
  const dls = await decodeLocalState(client, tokenBridgeId, lsa);
  const dlsBuffer: Buffer = Buffer.from(dls);
  retVal.chainId = dlsBuffer.readInt16BE(92) as ChainId;
  retVal.assetAddress = new Uint8Array(dlsBuffer.subarray(60, 60 + 32));
  return retVal;
}

/**
 * Returns an origin chain and asset address on {originChain} for a provided Wormhole wrapped address
 * @param client Algodv2 client
 * @param tokenBridgeId Application ID of the token bridge
 * @param assetId Algorand asset index
 * @returns Promise with the Algorand asset index or null
 */
export async function getWrappedAssetOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  chain: ChainId | Chain,
  contract: string,
): Promise<bigint | null> {
  const chainId = toChainId(chain);
  if (chainId === CHAIN_ID_ALGORAND) {
    return bytesToBigInt(hex.decode(contract));
  } else {
    let { lsa, doesExist } = await calcLogicSigAccount(
      client,
      tokenBridgeId,
      BigInt(chainId),
      contract,
    );
    if (!doesExist) {
      return null;
    }
    let asset: Uint8Array = await decodeLocalState(client, tokenBridgeId, lsa.address());
    if (asset.length > 8) {
      const tmp = Buffer.from(asset.slice(0, 8));
      return tmp.readBigUInt64BE(0);
    } else return null;
  }
}

/**
 * Calculates the logic sig account for the application
 * @param client An Algodv2 client
 * @param senderAddr Sender address
 * @param appId Application ID
 * @param appIndex Application index
 * @param emitterId Emitter address
 * @returns Address and array of TransactionSignerPairs
 */
export async function optIn(
  client: Algodv2,
  senderAddr: string,
  appId: bigint,
  appIndex: bigint,
  emitterId: string,
): Promise<OptInResult> {
  const appAddr: string = getApplicationAddress(appId);

  // Check to see if we need to create this
  const { doesExist, lsa } = await calcLogicSigAccount(client, appId, appIndex, emitterId);
  const sigAddr: string = lsa.address();
  let txs: TransactionSignerPair[] = [];
  if (!doesExist) {
    // These are the suggested params from the system
    const params = await client.getTransactionParams().do();
    const seedTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: sigAddr,
      amount: SEED_AMT,
      suggestedParams: params,
    });
    seedTxn.fee = seedTxn.fee * 2;
    txs.push({ tx: seedTxn, signer: null });
    const optinTxn = makeApplicationOptInTxnFromObject({
      from: sigAddr,
      suggestedParams: params,
      appIndex: safeBigIntToNumber(appId),
      rekeyTo: appAddr,
    });
    optinTxn.fee = 0;
    txs.push({
      tx: optinTxn,
      signer: {
        addr: lsa.address(),
        signTxn: (txn: Transaction) => Promise.resolve(signLogicSigTransaction(txn, lsa).blob),
      },
    });

    accountExistsCache.add([appId, lsa.address()]);
  }
  return {
    addr: sigAddr,
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
