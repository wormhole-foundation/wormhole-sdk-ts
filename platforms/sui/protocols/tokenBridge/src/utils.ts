import type { SuiClient, SuiObjectResponse } from "@mysten/sui.js/client";
import {
  getFieldsFromObjectResponse,
  getObjectFields,
  getPackageIdFromType,
  getTableKeyType,
  isMoveStructObject,
  isValidSuiType,
  trimSuiType,
} from "@wormhole-foundation/sdk-sui";

export const getTokenFromTokenRegistry = async (
  provider: SuiClient,
  tokenBridgeStateObjectId: string,
  tokenType: string,
): Promise<SuiObjectResponse> => {
  if (!isValidSuiType(tokenType)) {
    throw new Error(`Invalid Sui type: ${tokenType}`);
  }

  const tokenBridgeStateFields = await getObjectFields(provider, tokenBridgeStateObjectId);
  if (!tokenBridgeStateFields) {
    throw new Error(
      `Unable to fetch object fields from token bridge state. Object ID: ${tokenBridgeStateObjectId}`,
    );
  }

  const tokenRegistryObjectId = tokenBridgeStateFields["token_registry"].fields?.id?.id;
  if (!tokenRegistryObjectId) {
    throw new Error("Unable to fetch token registry object ID");
  }

  const tokenRegistryPackageId = getPackageIdFromType(
    tokenBridgeStateFields["token_registry"]?.type,
  );

  if (!tokenRegistryPackageId) {
    throw new Error("Unable to fetch token registry package ID");
  }

  return provider.getDynamicFieldObject({
    parentId: tokenRegistryObjectId,
    name: {
      type: `${tokenRegistryPackageId}::token_registry::Key<${tokenType}>`,
      value: {
        dummy_field: false,
      },
    },
  });
};

export const getTokenCoinType = async (
  provider: SuiClient,
  tokenBridgeStateObjectId: string,
  tokenAddress: Uint8Array,
  tokenChain: number,
): Promise<string | null> => {
  const tokenBridgeStateFields = await getObjectFields(provider, tokenBridgeStateObjectId);

  if (!tokenBridgeStateFields)
    throw new Error("Unable to fetch object fields from token bridge state");

  const coinTypes = tokenBridgeStateFields["token_registry"]?.fields?.coin_types;
  const coinTypesObjectId = coinTypes?.fields?.id?.id;
  if (!coinTypesObjectId) {
    throw new Error("Unable to fetch coin types");
  }

  const keyType = getTableKeyType(coinTypes?.type);
  if (!keyType) {
    throw new Error("Unable to get key type");
  }

  const response = await provider.getDynamicFieldObject({
    parentId: coinTypesObjectId,
    name: {
      type: keyType,
      value: {
        addr: [...tokenAddress],
        chain: tokenChain,
      },
    },
  });
  if (response.error) {
    if (response.error.code === "dynamicFieldNotFound") {
      return null;
    }
    throw new Error(`Unexpected getDynamicFieldObject response ${response.error}`);
  }
  const fields = getFieldsFromObjectResponse(response);
  if (!fields) return null;
  if (!isMoveStructObject(fields)) throw new Error("What?");

  return "value" in fields ? trimSuiType(fields["value"] as string) : null;
};
