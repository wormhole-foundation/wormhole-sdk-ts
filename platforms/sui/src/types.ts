import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui.js/utils";
import { MoveValue, SuiObjectResponse, SuiTransactionBlockResponse } from "@mysten/sui.js/client";
import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/connect-sdk";
import { SUI_SEPARATOR } from "./constants";

export const _platform: "Sui" = "Sui";
export type SuiPlatformType = typeof _platform;

export type SuiChains = PlatformToChains<SuiPlatformType>;
export type UniversalOrSui = UniversalOrNative<SuiChains>;
export type AnySuiAddress = UniversalOrSui | string | Uint8Array;

export type SuiBuildOutput = {
  modules: string[];
  dependencies: string[];
};

export const trimSuiType = (type: string): string => type.replace(/(0x)(0*)/g, "0x");

export const normalizeSuiType = (type: string): string => {
  const tokens = type.split(SUI_SEPARATOR);
  if (tokens.length !== 3) throw new Error(`Invalid Sui type: ${type}`);

  return [normalizeSuiAddress(tokens[0]!), tokens[1], tokens[2]].join(SUI_SEPARATOR);
};

export const getCoinTypeFromPackageId = (coinPackageId: string): string => {
  if (!isValidSuiAddress(coinPackageId)) throw new Error(`Invalid package ID: ${coinPackageId}`);
  return [coinPackageId, "coin", "COIN"].join(SUI_SEPARATOR);
};

export const getPackageIdFromType = (type: string): string => {
  if (!isValidSuiType(type)) throw new Error("Invalid Sui type" + type);

  const packageId = type.split(SUI_SEPARATOR)[0]!;
  if (!packageId || !isValidSuiAddress(packageId))
    throw new Error("Invalid package id: " + packageId);

  return packageId;
};

export const getTableKeyType = (tableType: string): string => {
  const match = trimSuiType(tableType).match(/0x2::table::Table<(.*)>/);
  if (!match) throw new Error(`Invalid table type: ${tableType}`);
  if (match.length < 2) throw new Error(`Invalid table type: ${tableType}`);

  const [keyType] = match[1]!.split(",");
  if (!keyType || !isValidSuiType(keyType!)) throw new Error(`Invalid key type: ${keyType}`);

  return keyType;
};

export const getFieldsFromObjectResponse = (object: SuiObjectResponse) => {
  const content = object.data?.content;
  return content && content.dataType === "moveObject" ? content.fields : null;
};

export const isSameType = (a: string, b: string) => {
  try {
    return normalizeSuiType(a) === normalizeSuiType(b);
  } catch {
    return false;
  }
};

// Event typeguard helpers
export const isSuiCreateEvent = <
  T extends NonNullable<SuiTransactionBlockResponse["objectChanges"]>[number],
  K extends Extract<T, { type: "created" }>,
>(
  event: T,
): event is K => event?.type === "created";

export const isSuiPublishEvent = <
  T extends NonNullable<SuiTransactionBlockResponse["objectChanges"]>[number],
  K extends Extract<T, { type: "published" }>,
>(
  event: T,
): event is K => event?.type === "published";

//
// MoveStruct typeguard helpers
//
export function isMoveStructArray(value: any): value is MoveValue[] {
  return Array.isArray(value);
}
export function isMoveStructStruct(
  value: any,
): value is { fields: { [key: string]: MoveValue }; type: string } {
  return !Array.isArray(value) && typeof value === "object" && "fields" in value && "type" in value;
}
export function isMoveStructObject(value: any): value is { [key: string]: MoveValue } {
  return typeof value === "object" && !isMoveStructArray(value) && !isMoveStructStruct(value);
}

export const isValidSuiType = (str: string): boolean => /^(0x)?[0-9a-fA-F]+::\w+::\w+$/.test(str);
