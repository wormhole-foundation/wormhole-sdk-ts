import {
  MAINNET_CHAINS,
  ChainId,
  WormholeWrappedInfo,
} from '@wormhole-foundation/connect-sdk';
import {
  getFieldsFromObjectResponse,
  getTokenFromTokenRegistry,
  isValidSuiType,
  trimSuiType,
} from './utils';
import { JsonRpcProvider } from '@mysten/sui.js';

export async function getOriginalAssetSui(
  provider: JsonRpcProvider,
  tokenBridgeStateObjectId: string,
  coinType: string,
): Promise<WormholeWrappedInfo> {
  if (!isValidSuiType(coinType)) {
    throw new Error(`Invalid Sui type: ${coinType}`);
  }

  const res = await getTokenFromTokenRegistry(
    provider,
    tokenBridgeStateObjectId,
    coinType,
  );
  const fields = getFieldsFromObjectResponse(res);
  if (!fields) {
    throw new Error(
      `Token of type ${coinType} has not been registered with the token bridge`,
    );
  }

  // Normalize types
  const type = trimSuiType(fields.value.type);
  coinType = trimSuiType(coinType);

  // Check if wrapped or native asset. We check inclusion instead of equality
  // because it saves us from making an additional RPC call to fetch the
  // package ID.
  if (type.includes(`wrapped_asset::WrappedAsset<${coinType}>`)) {
    return {
      isWrapped: true,
      chainId: Number(fields.value.fields.info.fields.token_chain) as ChainId,
      assetAddress: new Uint8Array(
        fields.value.fields.info.fields.token_address.fields.value.fields.data,
      ),
    };
  } else if (type.includes(`native_asset::NativeAsset<${coinType}>`)) {
    return {
      isWrapped: false,
      chainId: MAINNET_CHAINS.sui,
      assetAddress: new Uint8Array(
        fields.value.fields.token_address.fields.value.fields.data,
      ),
    };
  }

  throw new Error(
    `Unrecognized token metadata: ${JSON.stringify(
      fields,
      null,
      2,
    )}, ${coinType}`,
  );
}
