import {
  ChainName,
  ChainId,
  toChainId,
  UniversalAddress,
  deserialize,
} from '@wormhole-foundation/connect-sdk';
import {
  CHAIN_ID_ALGORAND,
  TransactionSignerPair,
} from '@wormhole-foundation/connect-sdk-algorand';
import {
  Algodv2,
  bigIntToBytes,
  decodeAddress,
  getApplicationAddress,
  LogicSigAccount,
  makeApplicationCallTxnFromObject,
  makeApplicationOptInTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  OnApplicationComplete,
  signLogicSigTransaction,
  SuggestedParams,
  Transaction,
} from 'algosdk';
import { SEED_AMT, BITS_PER_KEY, MAX_BITS } from './constants';
import {
  hexToNativeAssetBigIntAlgorand,
  safeBigIntToNumber,
  textToHexString,
  textToUint8Array,
  uint8ArrayToHex,
} from './utilities';
import { PopulateData, TmplSig } from './TmplSig';
import { OptInResult, WormholeWrappedInfo } from './types';
import { _parseVAAAlgorand, _submitVAAAlgorand } from './vaa';

const accountExistsCache = new Set<[bigint, string]>();

export function getEmitterAddressAlgorand(appId: bigint): string {
  console.log('appId: ', appId);
  const appAddr: string = getApplicationAddress(appId);
  const decAppAddr: Uint8Array = decodeAddress(appAddr).publicKey;
  const hexAppAddr: string = uint8ArrayToHex(decAppAddr);
  console.log('functions.ts Emitter address: ', hexAppAddr);
  return hexAppAddr;
}

export async function createWrappedOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  attestVAA: Uint8Array,
): Promise<TransactionSignerPair[]> {
  return await _submitVAAAlgorand(
    client,
    tokenBridgeId,
    bridgeId,
    attestVAA,
    senderAddr,
  );
}

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
  const assetInfo = await client.getAssetByID(Number(assetId)).do();
  const creatorAddr = assetInfo['params']['creator'];
  const creatorAcctInfo = await client.accountInformation(creatorAddr).do();
  const wormhole: boolean = creatorAcctInfo['auth-addr'] === tbAddr;
  return wormhole;
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
  chain: ChainId | ChainName,
  contract: string,
): Promise<bigint | null> {
  const chainId = toChainId(chain);
  if (chainId === CHAIN_ID_ALGORAND) {
    return hexToNativeAssetBigIntAlgorand(contract);
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
    let asset: Uint8Array = await decodeLocalState(
      client,
      tokenBridgeId,
      lsa.address(),
    );
    if (asset.length > 8) {
      const tmp = Buffer.from(asset.slice(0, 8));
      return tmp.readBigUInt64BE(0);
    } else return null;
  }
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
  retVal.isWrapped = await getIsWrappedAssetOnAlgorand(
    client,
    tokenBridgeId,
    assetId,
  );
  if (!retVal.isWrapped) {
    retVal.assetAddress = bigIntToBytes(assetId, 32);
    return retVal;
  }
  const assetInfo = await client.getAssetByID(safeBigIntToNumber(assetId)).do();
  const lsa = assetInfo['params']['creator'];
  const dls = await decodeLocalState(client, tokenBridgeId, lsa);
  const dlsBuffer: Buffer = Buffer.from(dls);
  retVal.chainId = dlsBuffer.readInt16BE(92) as ChainId;
  // retVal.assetAddress = new Uint8Array(dlsBuffer.slice(60, 60 + 32));
  retVal.assetAddress = new Uint8Array(dlsBuffer.subarray(60, 60 + 32));
  return retVal;
}

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
  let appState: any[] = [];
  const acctInfo = await client.accountInformation(addr).do();
  const als = acctInfo['apps-local-state'];
  als.forEach((app: any) => {
    if (BigInt(app['id']) === appId) {
      appState = app['key-value'];
    }
  });
  if (appState.length === 0) {
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

  const key = Buffer.from(bigIntToBytes(s, 1)).toString('base64');
  appState.forEach((kv) => {
    if (kv['key'] === key) {
      const v = Buffer.from(kv['value']['bytes'], 'base64');
      const bt = 1 << safeBigIntToNumber(seq % BIG_EIGHT);
      retval = (v[b] & bt) != 0;
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
  const { addr: emitterAddr, txs: emitterOptInTxs } = await optin(
    client,
    senderAddr,
    bridgeId,
    BigInt(0),
    aa,
  );
  txs.push(...emitterOptInTxs);

  let creatorAddr = '';
  let creatorAcctInfo;
  const bPgmName: Uint8Array = textToUint8Array('attestToken');

  if (assetId !== BigInt(0)) {
    const assetInfo = await client
      .getAssetByID(safeBigIntToNumber(assetId))
      .do();
    creatorAcctInfo = await client
      .accountInformation(assetInfo['params']['creator'])
      .do();
    if (creatorAcctInfo['auth-addr'] === tbAddr) {
      throw new Error('Cannot re-attest wormhole assets');
    }
  }
  const result = await optin(
    client,
    senderAddr,
    tokenBridgeId,
    assetId,
    textToHexString('native'),
  );
  creatorAddr = result.addr;
  txs.push(...result.txs);

  const suggParams: SuggestedParams = await client.getTransactionParams().do();

  const firstTxn = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: [textToUint8Array('nop')],
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

  let accts: string[] = [
    emitterAddr,
    creatorAddr,
    getApplicationAddress(bridgeId),
  ];

  if (creatorAcctInfo) {
    accts.push(creatorAcctInfo['address']);
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
 * Return the message fee for the core bridge
 * @param client An Algodv2 client
 * @param bridgeId The application ID of the core bridge
 * @returns Promise with the message fee for the core bridge
 */
export async function getMessageFee(
  client: Algodv2,
  bridgeId: bigint,
): Promise<bigint> {
  const applInfo: Record<string, any> = await client
    .getApplicationByID(safeBigIntToNumber(bridgeId))
    .do();
  const globalState = applInfo['params']['global-state'];
  const key: string = Buffer.from('MessageFee', 'binary').toString('base64');
  let ret = BigInt(0);
  globalState.forEach((el: any) => {
    if (el['key'] === key) {
      ret = BigInt(el['value']['uint']);
      return;
    }
  });
  console.log('Message Fee: ', ret);
  return ret;
}

/**
 * Checks to see it the account exists for the application
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
    const acctInfo = await client.accountInformation(acctAddr).do();
    const als: Record<string, any>[] = acctInfo['apps-local-state'];
    if (!als) {
      return ret;
    }
    als.forEach((app) => {
      if (BigInt(app['id']) === appId) {
        accountExistsCache.add([appId, acctAddr]);
        ret = true;
        return;
      }
    });
  } catch (e) {}
  return ret;
}

export type LogicSigAccountInfo = {
  lsa: LogicSigAccount;
  doesExist: boolean;
};

/**
 * Calculates the logic sig account for the application
 * @param client An Algodv2 client
 * @param appId Application ID
 * @param appIndex Application index
 * @param emitterId Emitter address
 * @returns Promise with LogicSigAccountInfo
 */
export async function calcLogicSigAccount(
  client: Algodv2,
  appId: bigint,
  appIndex: bigint,
  emitterId: string,
): Promise<LogicSigAccountInfo> {
  let data: PopulateData = {
    addrIdx: appIndex,
    appAddress: getEmitterAddressAlgorand(appId),
    appId: appId,
    emitterId: emitterId,
  };

  const ts: TmplSig = new TmplSig(client);
  const lsa: LogicSigAccount = await ts.populate(data);
  const sigAddr: string = lsa.address();

  const doesExist: boolean = await accountExists(client, appId, sigAddr);
  return {
    lsa,
    doesExist,
  };
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
export async function optin(
  client: Algodv2,
  senderAddr: string,
  appId: bigint,
  appIndex: bigint,
  emitterId: string,
): Promise<OptInResult> {
  const appAddr: string = getApplicationAddress(appId);

  // Check to see if we need to create this
  const { doesExist, lsa } = await calcLogicSigAccount(
    client,
    appId,
    appIndex,
    emitterId,
  );
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
        signTxn: (txn: Transaction) =>
          Promise.resolve(signLogicSigTransaction(txn, lsa).blob),
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
 * Returns the local data for an application ID
 * @param client Algodv2 client
 * @param appId Application ID of interest
 * @param address Address of the account
 * @returns Promise with Uint8Array of data squirreled away
 */
export async function decodeLocalState(
  client: Algodv2,
  appId: bigint,
  address: string,
): Promise<Uint8Array> {
  let appState = null;
  const ai = await client.accountInformation(address).do();
  for (const app of ai['apps-local-state']) {
    if (BigInt(app['id']) === appId) {
      appState = app['key-value'];
      break;
    }
  }

  let ret = Buffer.alloc(0);
  let empty = Buffer.alloc(0);
  if (appState) {
    const e = Buffer.alloc(127);
    const m = Buffer.from('meta');

    let sk: string[] = [];
    let vals: Map<string, Buffer> = new Map<string, Buffer>();
    for (const kv of appState) {
      const k = Buffer.from(kv['key'], 'base64');
      const key: number = k.readInt8();
      if (!Buffer.compare(k, m)) {
        continue;
      }
      const v: Buffer = Buffer.from(kv['value']['bytes'], 'base64');
      if (Buffer.compare(v, e)) {
        vals.set(key.toString(), v);
        sk.push(key.toString());
      }
    }

    sk.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

    sk.forEach((v) => {
      ret = Buffer.concat([ret, vals.get(v) || empty]);
    });
  }
  return new Uint8Array(ret);
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
  const acctInfo = await client.accountInformation(receiver).do();
  const assets: Array<any> = acctInfo['assets'];
  let ret = false;
  assets.forEach((a) => {
    const assetId = BigInt(a['asset-id']);
    if (assetId === asset) {
      ret = true;
      return;
    }
  });
  return ret;
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
  chain: ChainId | ChainName,
  fee: bigint,
  payload: Uint8Array | null = null,
): Promise<TransactionSignerPair[]> {
  const recipientChainId = toChainId(chain);
  const tokenAddr: string = getApplicationAddress(tokenBridgeId);
  const applAddr: string = getEmitterAddressAlgorand(tokenBridgeId);
  const txs: TransactionSignerPair[] = [];
  // "transferAsset"
  const { addr: emitterAddr, txs: emitterOptInTxs } = await optin(
    client,
    senderAddr,
    bridgeId,
    BigInt(0),
    applAddr,
  );
  txs.push(...emitterOptInTxs);
  let creator;
  let creatorAcctInfo: any;
  let wormhole: boolean = false;
  if (assetId !== BigInt(0)) {
    const assetInfo: Record<string, any> = await client
      .getAssetByID(safeBigIntToNumber(assetId))
      .do();
    creator = assetInfo['params']['creator'];
    creatorAcctInfo = await client.accountInformation(creator).do();
    const authAddr: string = creatorAcctInfo['auth-addr'];
    if (authAddr === tokenAddr) {
      wormhole = true;
    }
  }

  const params: SuggestedParams = await client.getTransactionParams().do();
  const msgFee: bigint = await getMessageFee(client, bridgeId);
  if (msgFee > 0) {
    const payTxn: Transaction = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      suggestedParams: params,
      to: getApplicationAddress(tokenBridgeId),
      amount: msgFee,
    });
    txs.push({ tx: payTxn, signer: null });
  }
  if (!wormhole) {
    const bNat = Buffer.from('native', 'binary').toString('hex');
    // "creator"
    const result = await optin(
      client,
      senderAddr,
      tokenBridgeId,
      assetId,
      bNat,
    );
    creator = result.addr;
    txs.push(...result.txs);
  }
  if (
    assetId !== BigInt(0) &&
    !(await assetOptinCheck(client, assetId, creator))
  ) {
    // Looks like we need to optin
    const payTxn: Transaction = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: creator,
      amount: 100000,
      suggestedParams: params,
    });
    txs.push({ tx: payTxn, signer: null });
    // The tokenid app needs to do the optin since it has signature authority
    const bOptin: Uint8Array = textToUint8Array('optin');
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
    appArgs: [textToUint8Array('nop')],
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
    accounts = [emitterAddr, creator, creatorAcctInfo['address']];
  }
  console.log('transferFromAlgorand receiver: ', receiver);
  const receiverBytes = new Uint8Array(receiver.toUint8Array());
  console.log('receiverBytes: ', receiverBytes);

  let args = [
    textToUint8Array('sendTransfer'),
    bigIntToBytes(assetId, 8),
    bigIntToBytes(qty, 8),
    receiverBytes,
    bigIntToBytes(recipientChainId, 8),
    bigIntToBytes(fee, 8),
  ];
  console.log('Args: ', args);
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

/**
 * This basically just submits the VAA to Algorand
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
  // _submitVAAAlgorand -> submitVAAHeader -> _parseVAAAlgorand
  return await _submitVAAAlgorand(
    client,
    tokenBridgeId,
    bridgeId,
    vaa,
    senderAddr,
  );
}
