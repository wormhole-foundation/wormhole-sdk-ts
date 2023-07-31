import { AptosClient } from 'aptos';
import { ChainId } from '@wormhole-foundation/connect-sdk';
import { coalesceModuleAddress, getAssetFullyQualifiedType } from './utils';

/**
 * Get qualified type of asset on Aptos given its origin info.
 * @param client Client used to transfer data to/from Aptos node
 * @param tokenBridgeAddress Address of token bridge
 * @param originChainId Chain ID of chain asset is originally from
 * @param originAddress Asset address on origin chain
 * @returns Fully qualified type of asset on Aptos
 */
export async function getForeignAssetAptos(
  client: AptosClient,
  tokenBridgeAddress: string,
  originChainId: ChainId,
  originAddress: string,
): Promise<string | null> {
  const assetFullyQualifiedType = getAssetFullyQualifiedType(
    tokenBridgeAddress,
    originChainId,
    originAddress,
  );
  if (!assetFullyQualifiedType) {
    return null;
  }

  try {
    // check if asset exists and throw if it doesn't
    await client.getAccountResource(
      coalesceModuleAddress(assetFullyQualifiedType),
      `0x1::coin::CoinInfo<${assetFullyQualifiedType}>`,
    );
    return assetFullyQualifiedType;
  } catch (e) {
    return null;
  }
}
