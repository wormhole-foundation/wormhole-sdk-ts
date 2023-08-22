import { AptosClient } from 'aptos';
import {
  ensureHexPrefix,
  getSignedVAAHash,
} from '@wormhole-foundation/connect-sdk';
import { NftBridgeState } from '../types';

export async function getIsTransferCompletedAptos(
  client: AptosClient,
  nftBridgeAddress: string,
  transferVaa: Uint8Array,
): Promise<boolean> {
  // get handle
  nftBridgeAddress = ensureHexPrefix(nftBridgeAddress);
  const state = (
    await client.getAccountResource(
      nftBridgeAddress,
      `${nftBridgeAddress}::state::State`,
    )
  ).data as NftBridgeState;
  const handle = state.consumed_vaas.elems.handle;

  // check if vaa hash is in consumed_vaas
  const transferVaaHash = getSignedVAAHash(transferVaa);
  try {
    // when accessing Set<T>, key is type T and value is 0
    await client.getTableItem(handle, {
      key_type: 'vector<u8>',
      value_type: 'u8',
      key: transferVaaHash,
    });
    return true;
  } catch {
    return false;
  }
}
