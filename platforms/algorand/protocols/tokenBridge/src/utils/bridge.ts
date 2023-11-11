import { Algodv2, decodeAddress, getApplicationAddress } from 'algosdk';
import { uint8ArrayToHex, safeBigIntToNumber } from './conversions';

export function getEmitterAddressAlgorand(appId: bigint): string {
  const appAddr: string = getApplicationAddress(appId);
  const decAppAddr: Uint8Array = decodeAddress(appAddr).publicKey;
  const aa: string = uint8ArrayToHex(decAppAddr);
  return aa;
}

/**
 * Return the message fee for the core bridge
 * @param client An Algodv2 client
 * @param bridgeId The application ID of the core bridge
 * @returns The message fee for the core bridge
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
