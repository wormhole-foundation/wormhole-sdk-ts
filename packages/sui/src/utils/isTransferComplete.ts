import { JsonRpcProvider } from '@mysten/sui.js';
import { getObjectFields, getTableKeyType } from './utils';
import { getSignedVAAHash } from '@wormhole-foundation/connect-sdk';

export async function getIsTransferCompleted(
  provider: JsonRpcProvider,
  tokenBridgeStateObjectId: string,
  transferVAA: Uint8Array,
): Promise<boolean> {
  const tokenBridgeStateFields = await getObjectFields(
    provider,
    tokenBridgeStateObjectId,
  );
  if (!tokenBridgeStateFields) {
    throw new Error('Unable to fetch object fields from token bridge state');
  }

  const hashes = tokenBridgeStateFields.consumed_vaas?.fields?.hashes;
  const tableObjectId = hashes?.fields?.items?.fields?.id?.id;
  if (!tableObjectId) {
    throw new Error('Unable to fetch consumed VAAs table');
  }

  const keyType = getTableKeyType(hashes?.fields?.items?.type);
  if (!keyType) {
    throw new Error('Unable to get key type');
  }

  const hash = getSignedVAAHash(transferVAA);
  const response = await provider.getDynamicFieldObject({
    parentId: tableObjectId,
    name: {
      type: keyType,
      value: {
        data: [...Buffer.from(hash.slice(2), 'hex')],
      },
    },
  });
  if (!response.error) {
    return true;
  }

  if (response.error.code === 'dynamicFieldNotFound') {
    return false;
  }

  throw new Error(
    `Unexpected getDynamicFieldObject response ${response.error}`,
  );
}
