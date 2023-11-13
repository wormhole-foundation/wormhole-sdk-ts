// This file contains content adapted from @certusone/wormhole-sdk

import {
  ChainName,
  ChainId,
  toChainId,
} from '@wormhole-foundation/connect-sdk';
import { TransactionSignerPair } from '@wormhole-foundation/connect-sdk-algorand';
import abi, {
  Algodv2,
  bigIntToBytes,
  bytesToBigInt,
  decodeAddress,
  encodeAddress,
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
import { keccak256 } from 'ethers';
import { PopulateData, TmplSig } from './TmplSig';

const CHAIN_ID_ALGORAND = 8;

const SEED_AMT: number = 1002000;
const ZERO_PAD_BYTES =
  '0000000000000000000000000000000000000000000000000000000000000000';
const MAX_KEYS: number = 15;
const MAX_BYTES_PER_KEY: number = 127;
const BITS_PER_BYTE: number = 8;

export const BITS_PER_KEY: number = MAX_BYTES_PER_KEY * BITS_PER_BYTE;
const MAX_BYTES: number = MAX_BYTES_PER_KEY * MAX_KEYS;
export const MAX_BITS: number = BITS_PER_BYTE * MAX_BYTES;
const MAX_SIGS_PER_TXN: number = 6;

const ALGO_VERIFY_HASH =
  'EZATROXX2HISIRZDRGXW4LRQ46Z6IUJYYIHU3PJGP7P5IQDPKVX42N767A';
const ALGO_VERIFY = new Uint8Array([
  6, 32, 4, 1, 0, 32, 20, 38, 1, 0, 49, 32, 50, 3, 18, 68, 49, 1, 35, 18, 68,
  49, 16, 129, 6, 18, 68, 54, 26, 1, 54, 26, 3, 54, 26, 2, 136, 0, 3, 68, 34,
  67, 53, 2, 53, 1, 53, 0, 40, 53, 240, 40, 53, 241, 52, 0, 21, 53, 5, 35, 53,
  3, 35, 53, 4, 52, 3, 52, 5, 12, 65, 0, 68, 52, 1, 52, 0, 52, 3, 129, 65, 8,
  34, 88, 23, 52, 0, 52, 3, 34, 8, 36, 88, 52, 0, 52, 3, 129, 33, 8, 36, 88, 7,
  0, 53, 241, 53, 240, 52, 2, 52, 4, 37, 88, 52, 240, 52, 241, 80, 2, 87, 12,
  20, 18, 68, 52, 3, 129, 66, 8, 53, 3, 52, 4, 37, 8, 53, 4, 66, 255, 180, 34,
  137,
]);

const accountExistsCache = new Set<[bigint, string]>();

export type OptInResult = {
  addr: string;
  txs: TransactionSignerPair[];
};

export interface WormholeWrappedInfo {
  isWrapped: boolean;
  chainId: ChainId;
  assetAddress: Uint8Array;
}

export function getEmitterAddressAlgorand(appId: bigint): string {
  const appAddr: string = getApplicationAddress(appId);
  const decAppAddr: Uint8Array = decodeAddress(appAddr).publicKey;
  const aa: string = uint8ArrayToHex(decAppAddr);
  return aa;
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
export async function getIsWrappedAssetAlgorand(
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
export async function getForeignAssetAlgorand(
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
export async function getOriginalAssetAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  assetId: bigint,
): Promise<WormholeWrappedInfo> {
  let retVal: WormholeWrappedInfo = {
    isWrapped: false,
    chainId: CHAIN_ID_ALGORAND,
    assetAddress: new Uint8Array(),
  };
  retVal.isWrapped = await getIsWrappedAssetAlgorand(
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
  // QUESTIONBW: Is this the right way to resolve the deprecated .slice() method?
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
  const parsedVAA = _parseVAAAlgorand(signedVAA);
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

export type ParsedVAA = {
  version: number;
  index: number;
  siglen: number;
  signatures: Uint8Array;
  sigs: Uint8Array[];
  digest: Uint8Array;
  timestamp: number;
  nonce: number;
  chainRaw: string;
  chain: number;
  emitter: string;
  sequence: bigint;
  consistency: number;
  Meta:
    | 'Unknown'
    | 'TokenBridge'
    | 'TokenBridge RegisterChain'
    | 'TokenBridge UpgradeContract'
    | 'CoreGovernance'
    | 'TokenBridge Attest'
    | 'TokenBridge Transfer'
    | 'TokenBridge Transfer With Payload';
  module?: Uint8Array;
  action?: number;
  targetChain?: number;
  EmitterChainID?: number;
  targetEmitter?: Uint8Array;
  newContract?: Uint8Array;
  NewGuardianSetIndex?: number;
  Type?: number;
  Contract?: string;
  FromChain?: number;
  Decimals?: number;
  Symbol?: Uint8Array;
  Name?: Uint8Array;
  TokenId?: Uint8Array;
  Amount?: Uint8Array;
  ToAddress?: Uint8Array;
  ToChain?: number;
  Fee?: Uint8Array;
  FromAddress?: Uint8Array;
  Payload?: Uint8Array;
  Body?: Uint8Array;

  uri?: string;
};

/**
 * Parses the VAA into a Map
 * @param vaa The VAA to be parsed
 * @returns The ParsedVAA containing the parsed elements of the VAA
 */
export function _parseVAAAlgorand(vaa: Uint8Array): ParsedVAA {
  let ret = {} as ParsedVAA;
  let buf = Buffer.from(vaa);
  ret.version = buf.readIntBE(0, 1);
  ret.index = buf.readIntBE(1, 4);
  ret.siglen = buf.readIntBE(5, 1);
  const siglen = ret.siglen;
  if (siglen) {
    ret.signatures = extract3(vaa, 6, siglen * 66);
  }
  const sigs: Uint8Array[] = [];
  for (let i = 0; i < siglen; i++) {
    const start = 6 + i * 66;
    const len = 66;
    const sigBuf = extract3(vaa, start, len);
    sigs.push(sigBuf);
  }
  ret.sigs = sigs;
  let off = siglen * 66 + 6;
  ret.digest = vaa.slice(off); // This is what is actually signed...
  ret.timestamp = buf.readIntBE(off, 4);
  off += 4;
  ret.nonce = buf.readIntBE(off, 4);
  off += 4;
  ret.chainRaw = Buffer.from(extract3(vaa, off, 2)).toString('hex');
  ret.chain = buf.readIntBE(off, 2);
  off += 2;
  ret.emitter = Buffer.from(extract3(vaa, off, 32)).toString('hex');
  off += 32;
  ret.sequence = buf.readBigUInt64BE(off);
  off += 8;
  ret.consistency = buf.readIntBE(off, 1);
  off += 1;

  ret.Meta = 'Unknown';

  if (
    !Buffer.compare(
      extract3(buf, off, 32),
      Buffer.from(
        '000000000000000000000000000000000000000000546f6b656e427269646765',
        'hex',
      ),
    )
  ) {
    ret.Meta = 'TokenBridge';
    ret.module = extract3(vaa, off, 32);
    off += 32;
    ret.action = buf.readIntBE(off, 1);
    off += 1;
    if (ret.action === 1) {
      ret.Meta = 'TokenBridge RegisterChain';
      ret.targetChain = buf.readIntBE(off, 2);
      off += 2;
      ret.EmitterChainID = buf.readIntBE(off, 2);
      off += 2;
      ret.targetEmitter = extract3(vaa, off, 32);
      off += 32;
    } else if (ret.action === 2) {
      ret.Meta = 'TokenBridge UpgradeContract';
      ret.targetChain = buf.readIntBE(off, 2);
      off += 2;
      ret.newContract = extract3(vaa, off, 32);
      off += 32;
    }
  } else if (
    !Buffer.compare(
      extract3(buf, off, 32),
      Buffer.from(
        '00000000000000000000000000000000000000000000000000000000436f7265',
        'hex',
      ),
    )
  ) {
    ret.Meta = 'CoreGovernance';
    ret.module = extract3(vaa, off, 32);
    off += 32;
    ret.action = buf.readIntBE(off, 1);
    off += 1;
    ret.targetChain = buf.readIntBE(off, 2);
    off += 2;
    ret.NewGuardianSetIndex = buf.readIntBE(off, 4);
  }

  //    ret.len=vaa.slice(off).length)
  //    ret.act=buf.readIntBE(off, 1))

  ret.Body = vaa.slice(off);

  if (vaa.slice(off).length === 100 && buf.readIntBE(off, 1) === 2) {
    ret.Meta = 'TokenBridge Attest';
    ret.Type = buf.readIntBE(off, 1);
    off += 1;
    ret.Contract = uint8ArrayToHex(extract3(vaa, off, 32));
    off += 32;
    ret.FromChain = buf.readIntBE(off, 2);
    off += 2;
    ret.Decimals = buf.readIntBE(off, 1);
    off += 1;
    ret.Symbol = extract3(vaa, off, 32);
    off += 32;
    ret.Name = extract3(vaa, off, 32);
  }

  if (vaa.slice(off).length === 133 && buf.readIntBE(off, 1) === 1) {
    ret.Meta = 'TokenBridge Transfer';
    ret.Type = buf.readIntBE(off, 1);
    off += 1;
    ret.Amount = extract3(vaa, off, 32);
    off += 32;
    ret.Contract = uint8ArrayToHex(extract3(vaa, off, 32));
    off += 32;
    ret.FromChain = buf.readIntBE(off, 2);
    off += 2;
    ret.ToAddress = extract3(vaa, off, 32);
    off += 32;
    ret.ToChain = buf.readIntBE(off, 2);
    off += 2;
    ret.Fee = extract3(vaa, off, 32);
  }

  if (off >= buf.length) {
    return ret;
  }
  if (buf.readIntBE(off, 1) === 3) {
    ret.Meta = 'TokenBridge Transfer With Payload';
    ret.Type = buf.readIntBE(off, 1);
    off += 1;
    ret.Amount = extract3(vaa, off, 32);
    off += 32;
    ret.Contract = uint8ArrayToHex(extract3(vaa, off, 32));
    off += 32;
    ret.FromChain = buf.readIntBE(off, 2);
    off += 2;
    ret.ToAddress = extract3(vaa, off, 32);
    off += 32;
    ret.ToChain = buf.readIntBE(off, 2);
    off += 2;
    ret.FromAddress = extract3(vaa, off, 32);
    off += 32;
    ret.Payload = vaa.slice(off);
  }

  return ret;
}

export const METADATA_REPLACE = new RegExp('\u0000', 'g');

/**
 * Parses the VAA into a Map
 * @param vaa The VAA to be parsed
 * @returns The ParsedVAA containing the parsed elements of the VAA
 */
export function _parseNFTAlgorand(vaa: Uint8Array): ParsedVAA {
  let ret = _parseVAAAlgorand(vaa);

  let arr = Buffer.from(ret.Body as Uint8Array);

  ret.action = arr.readUInt8(0);
  ret.Contract = arr.slice(1, 1 + 32).toString('hex');
  ret.FromChain = arr.readUInt16BE(33);
  ret.Symbol = Buffer.from(arr.slice(35, 35 + 32));
  ret.Name = Buffer.from(arr.slice(67, 67 + 32));
  ret.TokenId = arr.slice(99, 99 + 32);
  let uri_len = arr.readUInt8(131);
  ret.uri = Buffer.from(arr.slice(132, 132 + uri_len))
    .toString('utf8')
    .replace(METADATA_REPLACE, '');
  let target_offset = 132 + uri_len;
  ret.ToAddress = arr.slice(target_offset, target_offset + 32);
  ret.ToChain = arr.readUInt16BE(target_offset + 32);

  return ret;
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

class SubmitVAAState {
  vaaMap: ParsedVAA;
  accounts: string[];
  txs: TransactionSignerPair[];
  guardianAddr: string;

  constructor(
    vaaMap: ParsedVAA,
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
  vaa: Uint8Array,
  senderAddr: string,
  appid: bigint,
): Promise<SubmitVAAState> {
  // A lot of our logic here depends on parseVAA and knowing what the payload is
  const parsedVAA = _parseVAAAlgorand(vaa);
  const seq: bigint = parsedVAA.sequence / BigInt(MAX_BITS);
  const chainRaw: string = parsedVAA.chainRaw; // QUESTIONBW: Does this need to be a hex string?  Comment was in wormhole-sdk
  const em: string = parsedVAA.emitter; // QUESTIONBW: Does this need to be a hex string?  Comment was in wormhole-sdk
  const index: number = parsedVAA.index;

  let txs: TransactionSignerPair[] = [];
  // "seqAddr"
  const { addr: seqAddr, txs: seqOptInTxs } = await optin(
    client,
    senderAddr,
    appid,
    seq,
    chainRaw + em,
  );
  txs.push(...seqOptInTxs);
  const guardianPgmName = textToHexString('guardian');
  // And then the signatures to help us verify the vaa_s
  // "guardianAddr"
  const { addr: guardianAddr, txs: guardianOptInTxs } = await optin(
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
  const keys: Uint8Array = await decodeLocalState(
    client,
    bridgeId,
    guardianAddr,
  );

  const params: SuggestedParams = await client.getTransactionParams().do();

  // We don't pass the entire payload in but instead just pass it pre-digested.  This gets around size
  // limitations with lsigs AND reduces the cost of the entire operation on a congested network by reducing the
  // bytes passed into the transaction
  // This is a 2 pass digest
  const digest = keccak256(keccak256(parsedVAA.digest)).slice(2);

  // How many signatures can we process in a single txn... we can do 6!
  // There are likely upwards of 19 signatures.  So, we ned to split things up
  const numSigs: number = parsedVAA.siglen;
  let numTxns: number = Math.floor(numSigs / MAX_SIGS_PER_TXN) + 1;

  const SIG_LEN: number = 66;
  const BSIZE: number = SIG_LEN * MAX_SIGS_PER_TXN;
  const signatures: Uint8Array = parsedVAA.signatures;
  const verifySigArg: Uint8Array = textToUint8Array('verifySigs');
  const lsa = new LogicSigAccount(ALGO_VERIFY);
  for (let nt = 0; nt < numTxns; nt++) {
    let sigs: Uint8Array = signatures.slice(nt * BSIZE);
    if (sigs.length > BSIZE) {
      sigs = sigs.slice(0, BSIZE);
    }

    // The keyset is the set of guardians that correspond
    // to the current set of signatures in this loop.
    // Each signature in 20 bytes and comes from decodeLocalState()
    const GuardianKeyLen: number = 20;
    const numSigsThisTxn = sigs.length / SIG_LEN;
    let arraySize: number = numSigsThisTxn * GuardianKeyLen;
    let keySet: Uint8Array = new Uint8Array(arraySize);
    for (let i = 0; i < numSigsThisTxn; i++) {
      // The first byte of the sig is the relative index of that signature in the signatures array
      // Use that index to get the appropriate guardian key
      const idx = sigs[i * SIG_LEN];
      const key = keys.slice(
        idx * GuardianKeyLen + 1,
        (idx + 1) * GuardianKeyLen + 1,
      );
      keySet.set(key, i * 20);
    }

    const appTxn = makeApplicationCallTxnFromObject({
      appArgs: [verifySigArg, sigs, keySet, hexToUint8Array(digest)],
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
        signTxn: (txn: Transaction) =>
          Promise.resolve(signLogicSigTransaction(txn, lsa).blob),
      },
    });
  }
  const appTxn = makeApplicationCallTxnFromObject({
    appArgs: [textToUint8Array('verifyVAA'), vaa],
    accounts: accts,
    appIndex: safeBigIntToNumber(bridgeId),
    from: senderAddr,
    onComplete: OnApplicationComplete.NoOpOC,
    suggestedParams: params,
  });
  appTxn.fee = appTxn.fee * (1 + numTxns);
  txs.push({ tx: appTxn, signer: null });

  return new SubmitVAAState(parsedVAA, accts, txs, guardianAddr);
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
  vaa: Uint8Array,
  senderAddr: string,
): Promise<TransactionSignerPair[]> {
  let sstate = await submitVAAHeader(
    client,
    bridgeId,
    vaa,
    senderAddr,
    tokenBridgeId,
  );

  let parsedVAA = sstate.vaaMap;
  let accts = sstate.accounts;
  let txs = sstate.txs;

  // If this happens to be setting up a new guardian set, we probably need it as well...
  if (
    parsedVAA.Meta === 'CoreGovernance' &&
    parsedVAA.action === 2 &&
    parsedVAA.NewGuardianSetIndex !== undefined
  ) {
    const ngsi = parsedVAA.NewGuardianSetIndex;
    const guardianPgmName = textToHexString('guardian');
    // "newGuardianAddr"
    const { addr: newGuardianAddr, txs: newGuardianOptInTxs } = await optin(
      client,
      senderAddr,
      bridgeId,
      BigInt(ngsi),
      guardianPgmName,
    );
    accts.push(newGuardianAddr);
    txs.unshift(...newGuardianOptInTxs);
  }

  // When we attest for a new token, we need some place to store the info... later we will need to
  // mirror the other way as well
  const meta = parsedVAA.Meta;
  let chainAddr: string = '';
  if (
    (meta === 'TokenBridge Attest' ||
      meta === 'TokenBridge Transfer' ||
      meta === 'TokenBridge Transfer With Payload') &&
    parsedVAA.Contract !== undefined
  ) {
    if (parsedVAA.FromChain !== CHAIN_ID_ALGORAND && parsedVAA.FromChain) {
      // "TokenBridge chainAddr"
      const result = await optin(
        client,
        senderAddr,
        tokenBridgeId,
        BigInt(parsedVAA.FromChain),
        parsedVAA.Contract,
      );
      chainAddr = result.addr;
      txs.unshift(...result.txs);
    } else {
      const assetId = hexToNativeAssetBigIntAlgorand(parsedVAA.Contract);
      // "TokenBridge native chainAddr"
      const result = await optin(
        client,
        senderAddr,
        tokenBridgeId,
        assetId,
        textToHexString('native'),
      );
      chainAddr = result.addr;
      txs.unshift(...result.txs);
    }
    accts.push(chainAddr);
  }

  const params: SuggestedParams = await client.getTransactionParams().do();

  if (meta === 'CoreGovernance') {
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [textToUint8Array('governance'), vaa],
        accounts: accts,
        appIndex: safeBigIntToNumber(bridgeId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [textToUint8Array('nop'), bigIntToBytes(5, 8)],
        appIndex: safeBigIntToNumber(bridgeId),
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });
  }
  if (
    meta === 'TokenBridge RegisterChain' ||
    meta === 'TokenBridge UpgradeContract'
  ) {
    txs.push({
      tx: makeApplicationCallTxnFromObject({
        appArgs: [textToUint8Array('governance'), vaa],
        accounts: accts,
        appIndex: safeBigIntToNumber(tokenBridgeId),
        foreignApps: [safeBigIntToNumber(bridgeId)],
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });
  }

  if (meta === 'TokenBridge Attest') {
    let asset: Uint8Array = await decodeLocalState(
      client,
      tokenBridgeId,
      chainAddr,
    );
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
        appArgs: [textToUint8Array('nop'), buf],
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
        appArgs: [textToUint8Array('nop'), buf],
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
        appArgs: [textToUint8Array('receiveAttest'), vaa],
        appIndex: safeBigIntToNumber(tokenBridgeId),
        foreignAssets: foreignAssets,
        from: senderAddr,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams: params,
      }),
      signer: null,
    });
    txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 2;
  }

  if (
    (meta === 'TokenBridge Transfer' ||
      meta === 'TokenBridge Transfer With Payload') &&
    parsedVAA.Contract !== undefined
  ) {
    let foreignAssets: number[] = [];
    let a: number = 0;
    if (parsedVAA.FromChain !== CHAIN_ID_ALGORAND) {
      let asset = await decodeLocalState(client, tokenBridgeId, chainAddr);

      if (asset.length > 8) {
        const tmp = Buffer.from(asset.slice(0, 8));
        a = safeBigIntToNumber(tmp.readBigUInt64BE(0));
      }
    } else {
      a = parseInt(parsedVAA.Contract, 16);
    }

    // The receiver needs to be optin in to receive the coins... Yeah, the relayer pays for this

    let aid = 0;
    let addr = '';

    if (parsedVAA.ToAddress !== undefined) {
      if (parsedVAA.ToChain === 8 && parsedVAA.Type === 3) {
        aid = Number(
          hexToNativeAssetBigIntAlgorand(uint8ArrayToHex(parsedVAA.ToAddress)),
        );
        addr = getApplicationAddress(aid);
      } else {
        addr = encodeAddress(parsedVAA.ToAddress);
      }
    }

    if (a !== 0) {
      foreignAssets.push(a);
      if (!(await assetOptinCheck(client, BigInt(a), addr))) {
        if (senderAddr != addr) {
          throw new Error(
            'cannot ASA optin for somebody else (asset ' + a.toString() + ')',
          );
        }

        txs.unshift({
          tx: makeAssetTransferTxnWithSuggestedParamsFromObject({
            amount: 0,
            assetIndex: a,
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
        appArgs: [textToUint8Array('completeTransfer'), vaa],
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
      parsedVAA.Fee !== undefined &&
      Buffer.compare(parsedVAA.Fee, Buffer.from(ZERO_PAD_BYTES, 'hex')) === 0
    )
      txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 2;
    else txs[txs.length - 1].tx.fee = txs[txs.length - 1].tx.fee * 3;

    if (meta === 'TokenBridge Transfer With Payload') {
      txs[txs.length - 1].tx.appForeignApps = [aid];

      let m = abi.ABIMethod.fromSignature('portal_transfer(byte[])byte[]');

      txs.push({
        tx: makeApplicationCallTxnFromObject({
          appArgs: [
            m.getSelector(),
            (m.args[0].type as abi.ABIType).encode(vaa),
          ],
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
  receiver: string,
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
  let args = [
    textToUint8Array('sendTransfer'),
    bigIntToBytes(assetId, 8),
    bigIntToBytes(qty, 8),
    hexToUint8Array(receiver),
    bigIntToBytes(recipientChainId, 8),
    bigIntToBytes(fee, 8),
  ];
  console.log('args: ', args);
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
  return await _submitVAAAlgorand(
    client,
    tokenBridgeId,
    bridgeId,
    vaa,
    senderAddr,
  );
}

function extract3(buffer: Uint8Array, start: number, size: number) {
  return buffer.slice(start, start + size);
}

export function safeBigIntToNumber(b: bigint): number {
  if (
    b < BigInt(Number.MIN_SAFE_INTEGER) ||
    b > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('integer is unsafe');
  }
  return Number(b);
}

export function uint8ArrayToNativeStringAlgorand(a: Uint8Array): string {
  return encodeAddress(a);
}

export function hexToNativeStringAlgorand(s: string): string {
  return uint8ArrayToNativeStringAlgorand(hexToUint8Array(s));
}

export function nativeStringToHexAlgorand(s: string): string {
  return uint8ArrayToHex(decodeAddress(s).publicKey);
}

export function hexToNativeAssetBigIntAlgorand(s: string): bigint {
  return bytesToBigInt(hexToUint8Array(s));
}

export function hexToNativeAssetStringAlgorand(s: string): string {
  return uint8ArrayToNativeStringAlgorand(hexToUint8Array(s));
}

export const uint8ArrayToHex = (a: Uint8Array): string => {
  return Buffer.from(a).toString('hex');
};

export const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith('0x')) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, 'hex'));
};

export function textToHexString(name: string): string {
  return Buffer.from(name, 'binary').toString('hex');
}

export function textToUint8Array(name: string): Uint8Array {
  return new Uint8Array(Buffer.from(name, 'binary'));
}
