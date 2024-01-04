import {
  Chain,
  TokenId,
  WormholeMessageId,
  encoding,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import { Algodv2, LogicSigAccount, decodeAddress, getApplicationAddress, modelsv2 } from "algosdk";
import { safeBigIntToNumber } from "@wormhole-foundation/connect-sdk-algorand";

export const SEED_AMT: number = 1002000;
export const MAX_KEYS: number = 15;
export const MAX_BYTES_PER_KEY: number = 127;
export const BITS_PER_BYTE: number = 8;
export const BITS_PER_KEY: number = MAX_BYTES_PER_KEY * BITS_PER_BYTE;
export const MAX_BYTES: number = MAX_BYTES_PER_KEY * MAX_KEYS;
export const MAX_BITS: number = BITS_PER_BYTE * MAX_BYTES;

export interface PopulateData {
  appId: bigint; // App ID we're storing data for
  appAddress: Uint8Array; // Address for the emitter, contract or Guardian
  address: Uint8Array;
  idx: bigint;
}

// Useful for encoding numbers as varints to patch TEAL binary
export const varint = {
  // Forever grateful to https://github.com/joeltg/big-varint/blob/main/src/unsigned.ts
  _limit: 0x7f,
  encodingLength: (value: number) => {
    let i = 0;
    for (; value >= 0x80; i++) value >>= 7;
    return i + 1;
  },
  encode: (i: bigint | number, buffer?: ArrayBuffer, byteOffset?: number) => {
    if (typeof i === "bigint") i = safeBigIntToNumber(i);

    if (i < 0) throw new RangeError("value must be unsigned");

    const byteLength = varint.encodingLength(i);
    buffer = buffer || new ArrayBuffer(byteLength);
    byteOffset = byteOffset || 0;

    if (buffer.byteLength < byteOffset + byteLength)
      throw new RangeError("the buffer is too small to encode the number at the offset");

    const array = new Uint8Array(buffer, byteOffset);

    let offset = 0;
    while (varint._limit < i) {
      array[offset++] = (i & varint._limit) | 0x80;
      i >>= 7;
    }
    array[offset] = Number(i);
    return array;
  },
  decode: (data: Uint8Array, offset = 0) => {
    let i = 0;
    let n = 0;
    let b: number | undefined;
    do {
      b = data[offset + n];
      if (b === undefined) throw new RangeError("offset out of range");

      i += (b & varint._limit) << (n * 7);
      n++;
    } while (0x80 <= b);
    return i;
  },
};

export const StorageLogicSig = {
  // Get the storage lsig for a Wormhole message ID
  forMessageId: (appId: bigint, whm: WormholeMessageId) => {
    const appAddress = decodeAddress(getApplicationAddress(appId)).publicKey;
    const emitterAddr = whm.emitter.toUniversalAddress().toUint8Array();
    const chainIdBytes = encoding.bignum.toBytes(BigInt(toChainId(whm.chain)), 2);
    const address = encoding.bytes.concat(chainIdBytes, emitterAddr);

    return StorageLogicSig.fromData({
      appId,
      appAddress,
      idx: whm.sequence / BigInt(MAX_BITS),
      address,
    });
  },
  // Get the storage lsig for a wrapped asset
  forWrappedAsset: (appId: bigint, token: TokenId<Chain>) => {
    const appAddress = decodeAddress(getApplicationAddress(appId)).publicKey;
    return StorageLogicSig.fromData({
      appId,
      appAddress,
      idx: BigInt(toChainId(token.chain)),
      address: token.address.toUniversalAddress().toUint8Array(),
    });
  },
  // Get the storage lsig for a native asset
  forNativeAsset: (appId: bigint, tokenId: bigint) => {
    const appAddress = decodeAddress(getApplicationAddress(appId)).publicKey;
    return StorageLogicSig.fromData({
      appId,
      appAddress,
      idx: tokenId,
      address: encoding.bytes.encode("native"),
    });
  },
  // Get the storage lsig for the guardian set
  forGuardianSet: (appId: bigint, idx: bigint | number) => {
    const appAddress = decodeAddress(getApplicationAddress(appId)).publicKey;
    return StorageLogicSig.fromData({
      appId,
      appAddress,
      idx: BigInt(idx),
      address: encoding.bytes.encode("guardian"),
    });
  },
  forEmitter: (appId: bigint, emitter: Uint8Array) => {
    const appAddress = decodeAddress(getApplicationAddress(appId)).publicKey;
    return StorageLogicSig.fromData({
      appId,
      appAddress,
      idx: 0n,
      address: emitter,
    });
  },
  _encode: (data: bigint | Uint8Array) => {
    if (typeof data === "bigint") return [encoding.hex.encode(varint.encode(data))];
    return [encoding.hex.encode(varint.encode(data.length)), encoding.hex.encode(data)];
  },
  fromData: (data: PopulateData) => {
    // This patches the binary of the TEAL program used to store data
    // to produce a logic sig that can be used to sign transactions
    // to store data in the its account local state for a given app
    const byteStrings = [
      "0620010181",
      ...StorageLogicSig._encode(data.idx),
      "4880",
      ...StorageLogicSig._encode(data.address),
      "483110810612443119221244311881",
      ...StorageLogicSig._encode(data.appId),
      "1244312080",
      ...StorageLogicSig._encode(data.appAddress),
      "124431018100124431093203124431153203124422",
    ];

    const bytecode = encoding.hex.decode(byteStrings.join(""));
    return new LogicSigAccount(bytecode);
  },

  /**
   * Returns the local data for an application ID
   * @param client Algodv2 client
   * @param appId Application ID of interest
   * @param address Address of the account
   * @returns Promise with Uint8Array of data squirreled away
   */
  decodeLocalState: async (client: Algodv2, appId: bigint, address: string) => {
    let appState: modelsv2.ApplicationLocalState;
    try {
      const ai = await client
        .accountApplicationInformation(address, safeBigIntToNumber(appId))
        .do();
      const acctAppInfo = modelsv2.AccountApplicationResponse.from_obj_for_encoding(ai);
      appState = acctAppInfo.appLocalState!;
    } catch (e) {
      return new Uint8Array();
    }

    const metaKey = encoding.b64.encode("meta");

    // We don't want the data in the `meta` key
    // and we want to make sure the sequences come back in order
    // so first put them in a map by numeric key
    // then iterate over keys to concat them in the right order
    let vals = new Map<number, Uint8Array>();
    for (const kv of appState!.keyValue!) {
      if (kv.key === metaKey) continue;

      // Take the first byte off the key to be the
      // numeric index
      const key = encoding.b64.decode(kv.key)[0]!;
      const value = encoding.b64.decode(kv.value.bytes);
      vals.set(key, value);
    }

    const byteArrays: Uint8Array[] = [];
    for (let i = 0; i < MAX_KEYS; i++) {
      if (vals.has(i)) byteArrays.push(vals.get(i)!);
    }

    return encoding.bytes.concat(...byteArrays);
  },

  /**
   * This function is used to check if a VAA has been redeemed by looking at a specific bit
   * @param client AlgodV2 client
   * @param appId Application Id
   * @param addr Wallet address. Someone has to pay for this
   * @param seq The sequence number of the redemption
   * @returns True, if the bit was set and VAA was redeemed, False otherwise
   */
  checkBitsSet: async (client: Algodv2, appId: bigint, addr: string, seq: bigint) => {
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

    const key = encoding.b64.encode(encoding.bignum.toBytes(s, 1));

    appState?.forEach((kv) => {
      if (kv.key === key) {
        const v = Buffer.from(kv.value.bytes, "base64");
        const bt = 1 << safeBigIntToNumber(seq % BIG_EIGHT);
        retval = (v[b]! & bt) != 0; // Added non-null assertion
        return;
      }
    });
    return retval;
  },

  /**
   * Checks to see if the account exists for the application
   * @param client An Algodv2 client
   * @param appId Application ID
   * @param acctAddr Account address to check
   * @returns True, if account exists for application, False otherwise
   */
  storageAccountExists: async (client: Algodv2, address: string, appId: bigint) => {
    try {
      const acctAppInfo = await client
        .accountApplicationInformation(address, safeBigIntToNumber(appId))
        .do();
      return Object.keys(acctAppInfo).length > 0;
    } catch {}
    return false;
  },
};
