import { Algodv2 } from 'algosdk';

export const accountExistsCache = new Set<[bigint, string]>();

/**
 * Checks to see it the account exists for the application
 * @param client An Algodv2 client
 * @param appId Application ID
 * @param acctAddr Account address to check
 * @returns true, if account exists for application.  Otherwise, returns false
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
