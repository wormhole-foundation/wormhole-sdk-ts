import type { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";
import { normalizeSuiType } from "./address.js";

export const _platform: "Sui" = "Sui";
export type SuiPlatformType = typeof _platform;

export type SuiChains = PlatformToChains<SuiPlatformType>;
export type UniversalOrSui = UniversalOrNative<SuiChains>;
export type AnySuiAddress = UniversalOrSui | string | Uint8Array;

export type SuiBuildOutput = {
  modules: string[];
  dependencies: string[];
};

/**
 * gRPC core `getObject({include:{json:true}})` returns a FLAT Move-struct map as
 * `object.json` (no JSON-RPC `{type, fields}` wrappers; UIDs are plain id strings;
 * tables are `{ id, size }`). The Move type lives on the top-level `object.type`.
 */
export type SuiObjectJson = Record<string, any>;

/** A gRPC core object response (or the unwrapped object) with json content included. */
export interface SuiJsonObject {
  type?: string;
  json?: Record<string, unknown> | null;
}

/** Returns the flat Move-struct fields (`object.json`) from a gRPC getObject result, or null. */
export const getFieldsFromObjectResponse = (
  object: SuiJsonObject | { object?: SuiJsonObject | null } | null | undefined,
): SuiObjectJson | null => {
  if (!object) return null;
  // Accept either the unwrapped object or the `{ object }` response envelope.
  const obj =
    "json" in object || "type" in object
      ? (object as SuiJsonObject)
      : (object as { object?: SuiJsonObject }).object;
  const json = obj?.json;
  return json && typeof json === "object" ? (json as SuiObjectJson) : null;
};

export const isSameType = (a: string, b: string) => {
  try {
    return normalizeSuiType(a) === normalizeSuiType(b);
  } catch {
    return false;
  }
};

// Object-change typeguards (used by the create-wrapped discovery path).
// Operate on entries shaped like `{ type: "created" | "published", ... }`.
export const isSuiCreateEvent = <
  T extends { type: string },
  K extends Extract<T, { type: "created" }>,
>(
  event: T,
): event is K => event?.type === "created";

export const isSuiPublishEvent = <
  T extends { type: string },
  K extends Extract<T, { type: "published" }>,
>(
  event: T,
): event is K => event?.type === "published";

//
// Flat-json value typeguards.
// In gRPC `object.json`, nested Move structs are plain nested objects (no `{type,fields}`
// wrapper), arrays are arrays, and IDs are plain strings.
//
export function isMoveStructArray(value: any): value is any[] {
  return Array.isArray(value);
}
export function isMoveStructObject(value: any): value is { [key: string]: any } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * In gRPC flat json there is no `{type, fields}` wrapper, so a "struct" is simply a
 * non-array object. Kept as a distinct export for call-site readability/compat.
 */
export function isMoveStructStruct(value: any): value is { [key: string]: any } {
  return isMoveStructObject(value);
}
export function isMoveStructId(value: any): value is { id: string } {
  return isMoveStructObject(value) && "id" in value;
}
