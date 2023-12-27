import { Algodv2, LogicSigAccount, decodeAddress, getApplicationAddress, modelsv2 } from "algosdk";
import { LogicSigAccountInfo } from "./types";
import { PopulateData, TmplSig } from "./tmplSig";
import { hex } from "@wormhole-foundation/sdk-base/src/utils/encoding";

const accountExistsCache = new Set<[bigint, string]>();

export function getEmitterAddressAlgorand(appId: bigint): string {
  console.log("appId: ", appId);
  const appAddr: string = getApplicationAddress(appId);
  const decAppAddr: Uint8Array = decodeAddress(appAddr).publicKey;
  const hexAppAddr: string = hex.encode(decAppAddr);
  console.log("Emitter address: ", hexAppAddr);
  return hexAppAddr;
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
