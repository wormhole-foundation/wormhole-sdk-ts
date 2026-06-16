import type { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  coinTypeKeyName,
  dummyFieldName,
  getDynamicFieldValue,
  getPackageIdFromType,
  isValidSuiType,
  trimSuiType,
} from "@wormhole-foundation/sdk-sui";

/** The fetched token-registry entry object (gRPC core), exposing top-level `type` + flat `json`. */
export interface TokenRegistryEntry {
  type: string;
  json: Record<string, any>;
}

export const getTokenFromTokenRegistry = async (
  provider: SuiGrpcClient,
  tokenBridgeStateObjectId: string,
  tokenType: string,
): Promise<TokenRegistryEntry | null> => {
  if (!isValidSuiType(tokenType)) {
    throw new Error(`Invalid Sui type: ${tokenType}`);
  }

  const { object: state } = await provider.getObject({
    objectId: tokenBridgeStateObjectId,
    include: { json: true },
  });
  if (!state || !state.json) {
    throw new Error(
      `Unable to fetch object fields from token bridge state. Object ID: ${tokenBridgeStateObjectId}`,
    );
  }

  // The token registry shares the token bridge's package id (derived from the state type).
  const tokenRegistryPackageId = getPackageIdFromType(state.type);
  const tokenRegistryObjectId = (state.json as any)["token_registry"]?.["id"];
  if (!tokenRegistryObjectId) {
    throw new Error("Unable to fetch token registry object ID");
  }

  try {
    const name = dummyFieldName(`${tokenRegistryPackageId}::token_registry::Key<${tokenType}>`);
    const { dynamicField } = await provider.getDynamicField({
      parentId: tokenRegistryObjectId,
      name,
    });
    const { object } = await provider.getObject({
      objectId: dynamicField.fieldId,
      include: { json: true },
    });
    if (!object || !object.json) return null;
    return { type: object.type, json: object.json as Record<string, any> };
  } catch {
    // dynamic field not found → token not registered
    return null;
  }
};

export const getTokenCoinType = async (
  provider: SuiGrpcClient,
  tokenBridgeStateObjectId: string,
  tokenAddress: Uint8Array,
  tokenChain: number,
): Promise<string | null> => {
  const { object: state } = await provider.getObject({
    objectId: tokenBridgeStateObjectId,
    include: { json: true },
  });
  if (!state || !state.json)
    throw new Error("Unable to fetch object fields from token bridge state");

  const tokenRegistryPackageId = getPackageIdFromType(state.type);
  const coinTypesObjectId = (state.json as any)["token_registry"]?.["coin_types"]?.["id"];
  if (!coinTypesObjectId) {
    throw new Error("Unable to fetch coin types");
  }

  const name = coinTypeKeyName(
    `${tokenRegistryPackageId}::token_registry::CoinTypeKey`,
    tokenChain,
    tokenAddress,
  );

  const value = await getDynamicFieldValue(provider, coinTypesObjectId, name);
  if (value === null || value === undefined) return null;
  // The value is the coin type as an ascii::String (rendered directly).
  return trimSuiType(value as string);
};
