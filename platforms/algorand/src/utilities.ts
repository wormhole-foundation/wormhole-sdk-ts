import { Algodv2, bigIntToBytes, modelsv2, decodeAddress, getApplicationAddress } from "algosdk";

export const SEED_AMT: number = 1002000;

export const ZERO_PAD_BYTES = "0000000000000000000000000000000000000000000000000000000000000000";

export const MAX_KEYS: number = 15;

export const MAX_BYTES_PER_KEY: number = 127;

export const BITS_PER_BYTE: number = 8;

export const BITS_PER_KEY: number = MAX_BYTES_PER_KEY * BITS_PER_BYTE;

export const MAX_BYTES: number = MAX_BYTES_PER_KEY * MAX_KEYS;

export const MAX_BITS: number = BITS_PER_BYTE * MAX_BYTES;

export const MAX_SIGS_PER_TXN: number = 6;

export const ALGO_VERIFY_HASH = "EZATROXX2HISIRZDRGXW4LRQ46Z6IUJYYIHU3PJGP7P5IQDPKVX42N767A";

export const ALGO_VERIFY = new Uint8Array([
  6, 32, 4, 1, 0, 32, 20, 38, 1, 0, 49, 32, 50, 3, 18, 68, 49, 1, 35, 18, 68, 49, 16, 129, 6, 18,
  68, 54, 26, 1, 54, 26, 3, 54, 26, 2, 136, 0, 3, 68, 34, 67, 53, 2, 53, 1, 53, 0, 40, 53, 240, 40,
  53, 241, 52, 0, 21, 53, 5, 35, 53, 3, 35, 53, 4, 52, 3, 52, 5, 12, 65, 0, 68, 52, 1, 52, 0, 52, 3,
  129, 65, 8, 34, 88, 23, 52, 0, 52, 3, 34, 8, 36, 88, 52, 0, 52, 3, 129, 33, 8, 36, 88, 7, 0, 53,
  241, 53, 240, 52, 2, 52, 4, 37, 88, 52, 240, 52, 241, 80, 2, 87, 12, 20, 18, 68, 52, 3, 129, 66,
  8, 53, 3, 52, 4, 37, 8, 53, 4, 66, 255, 180, 34, 137,
]);

export const METADATA_REPLACE = new RegExp("\u0000", "g");

export function safeBigIntToNumber(b: bigint): number {
  if (b < BigInt(Number.MIN_SAFE_INTEGER) || b > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Integer is unsafe");
  }
  return Number(b);
}

/**
 * This function is used to check if a VAA has been redeemed by looking at a specific bit
 * @param client AlgodV2 client
 * @param appId Application Id
 * @param addr Wallet address. Someone has to pay for this
 * @param seq The sequence number of the redemption
 * @returns True, if the bit was set and VAA was redeemed, False otherwise
 */
export async function checkBitsSet(
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
  return ret;
}

// Convert an id to the 32 byte Uint8array representing
// the bytes of the derived app address
export function idToAddressBytes(id: bigint): Uint8Array {
  const appAddr: string = getApplicationAddress(id);
  return decodeAddress(appAddr).publicKey;
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
  let appState;
  const ai = await client.accountInformation(address).do();
  const acctInfo = modelsv2.Account.from_obj_for_encoding(ai);
  for (const app of acctInfo.appsLocalState!) {
    if (BigInt(app.id) === appId) {
      appState = app.keyValue;
      break;
    }
  }

  let ret = Buffer.alloc(0);
  let empty = Buffer.alloc(0);
  if (appState) {
    const e = Buffer.alloc(127);
    const m = Buffer.from("meta");

    let sk: string[] = [];
    let vals: Map<string, Buffer> = new Map<string, Buffer>();
    for (const kv of appState) {
      const k = Buffer.from(kv.key, "base64");
      const key: number = k.readInt8();
      if (!Buffer.compare(k, m)) {
        continue;
      }
      const v: Buffer = Buffer.from(kv.value.bytes, "base64");
      if (Buffer.compare(v, e)) {
        vals.set(key.toString(), v);
        sk.push(key.toString());
      }
    }

    sk.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

    sk.forEach((v) => {
      ret = Buffer.concat([ret, vals.get(v) || empty]);
    });
  }
  return new Uint8Array(ret);
}
