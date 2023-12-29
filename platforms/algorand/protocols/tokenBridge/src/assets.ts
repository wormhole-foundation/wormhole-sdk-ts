import { safeBigIntToNumber } from "@wormhole-foundation/connect-sdk-algorand";
import { Algodv2, modelsv2 } from "algosdk";

/**
 * Checks if the asset has been opted in by the receiver
 * @param client Algodv2 client
 * @param asset Algorand asset index
 * @param receiver Account address
 * @returns Promise with True if the asset was opted in, False otherwise
 */
export async function isOptedIn(client: Algodv2, address: string, asset: bigint): Promise<boolean> {
  try {
    const acctInfoResp = await client
      .accountAssetInformation(address, safeBigIntToNumber(asset))
      .do();
    const acctInfo = modelsv2.AccountAssetResponse.from_obj_for_encoding(acctInfoResp);
    return acctInfo.assetHolding.amount > 0;
  } catch {}
  return false;
}
