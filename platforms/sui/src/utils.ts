import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { isValidSuiAddress, normalizeSuiAddress, normalizeSuiObjectId } from "@mysten/sui/utils";

import { encoding } from "@wormhole-foundation/sdk-connect";
import type { SuiBuildOutput } from "./types.js";
import { getFieldsFromObjectResponse, isMoveStructObject, isSameType } from "./types.js";
import { getPackageIdFromType, normalizeSuiType } from "./address.js";

export const UPGRADE_CAP_TYPE = "0x2::package::UpgradeCap";

//
// gRPC dynamic-field name BCS encoders.
//
// The gRPC core API requires dynamic-field names as `{ type, bcs }` where `bcs` is the
// BCS-encoded key value (the JSON-RPC `name.value` is gone). Helpers below cover the key
// shapes used across the Sui protocols.
//

/** Move struct `{ dummy_field: bool=false }` (e.g. `token_registry::Key<T>`) → BCS `[0]`. */
export const dummyFieldName = (type: string) => ({ type, bcs: new Uint8Array([0]) });

/** `token_registry::CoinTypeKey { chain: u16, addr: vector<u8> }`. */
const CoinTypeKeyBcs = bcs.struct("CoinTypeKey", {
  chain: bcs.u16(),
  addr: bcs.vector(bcs.u8()),
});
export const coinTypeKeyName = (type: string, chain: number, addr: Uint8Array) => ({
  type,
  bcs: CoinTypeKeyBcs.serialize({ chain, addr: Array.from(addr) }).toBytes(),
});

/** A `vector<u8>` key (e.g. relayer-fee keys). */
export const bytesVectorName = (type: string, bytes: Uint8Array) => ({
  type,
  bcs: bcs.vector(bcs.u8()).serialize(Array.from(bytes)).toBytes(),
});

/** A `u16` key (e.g. chain id). */
export const u16Name = (type: string, value: number) => ({
  type,
  bcs: bcs.u16().serialize(value).toBytes(),
});

//
// Utils to fetch data from Sui
//

/**
 * Fetch a dynamic field's flat value (`object.json.value`) by BCS-encoded name, or null
 * if the field does not exist.
 */
export const getDynamicFieldValue = async (
  provider: SuiGrpcClient,
  parentId: string,
  name: { type: string; bcs: Uint8Array },
): Promise<any> => {
  try {
    const { dynamicField } = await provider.getDynamicField({ parentId, name });
    const { object } = await provider.getObject({
      objectId: dynamicField.fieldId,
      include: { json: true },
    });
    const json = (object?.json ?? null) as Record<string, any> | null;
    return json && "value" in json ? json["value"] : null;
  } catch {
    // missing dynamic field → treat as not found
    return null;
  }
};

export const getOriginalPackageId = async (provider: SuiGrpcClient, stateObjectId: string) => {
  const { object } = await provider.getObject({ objectId: stateObjectId, include: { json: true } });
  if (!object || !object.type) throw new Error(`Cannot get object for state id ${stateObjectId}`);
  return getPackageIdFromType(object.type);
};

export const getObjectFields = async (
  provider: SuiGrpcClient,
  objectId: string,
): Promise<Record<string, any> | null> => {
  if (!isValidSuiAddress(objectId)) {
    throw new Error(`Invalid object ID: ${objectId}`);
  }
  const { object } = await provider.getObject({ objectId, include: { json: true } });
  return getFieldsFromObjectResponse(object);
};

export const getPackageId = async (provider: SuiGrpcClient, objectId: string): Promise<string> => {
  let currentPackage: { fieldId: string } | undefined;
  let nextCursor: string | null | undefined;
  do {
    const dynamicFields = await provider.listDynamicFields({
      parentId: objectId,
      cursor: nextCursor,
    });
    currentPackage = dynamicFields.dynamicFields.find((field) =>
      field.name.type.endsWith("CurrentPackage"),
    );
    nextCursor = dynamicFields.hasNextPage ? dynamicFields.cursor : null;
  } while (nextCursor && !currentPackage);

  if (!currentPackage) throw new Error("CurrentPackage not found");

  const { object } = await provider.getObject({
    objectId: currentPackage.fieldId,
    include: { json: true },
  });

  const fields = getFieldsFromObjectResponse(object);

  if (!fields || !isMoveStructObject(fields["value"])) throw new Error("Unable to get package id");

  return fields["value"]["package"] as string;
};

export const getOldestEmitterCapObjectId = async (
  provider: SuiGrpcClient,
  coreBridgePackageId: string,
  owner: string,
): Promise<string | null> => {
  let oldestVersion: string | null = null;
  let oldestObjectId: string | null = null;
  let nextCursor: string | null | undefined;
  do {
    const response = await provider.listOwnedObjects({
      owner,
      type: `${coreBridgePackageId}::emitter::EmitterCap`,
      cursor: nextCursor,
    });

    for (const obj of response.objects) {
      const { version, objectId } = obj;
      if (oldestVersion === null || version < oldestVersion) {
        oldestVersion = version;
        oldestObjectId = objectId;
      }
    }
    nextCursor = response.hasNextPage ? response.cursor : null;
  } while (nextCursor);
  return oldestObjectId;
};

export const getOwnedObjectId = async (
  provider: SuiGrpcClient,
  owner: string,
  type: string,
): Promise<string | null> => {
  // Upgrade caps are a special case
  if (isSameType(type, UPGRADE_CAP_TYPE)) {
    throw new Error(
      "`getOwnedObjectId` should not be used to get the object ID of an `UpgradeCap`. Use `getUpgradeCapObjectId` instead.",
    );
  }

  const res = await provider.listOwnedObjects({ owner, type });
  const objects = res.objects.filter((o) => o.objectId);
  if (objects.length === 0) return null;
  if (objects.length === 1) {
    return objects[0]!.objectId ?? null;
  } else {
    const objectsStr = JSON.stringify(objects, null, 2);
    throw new Error(
      `Found multiple objects owned by ${owner} of type ${type}. This may mean that we've received an unexpected response from the Sui RPC and \`worm\` logic needs to be updated to handle this. Objects: ${objectsStr}`,
    );
  }
};

export const getOwnedObjectIdPaginated = async (
  provider: SuiGrpcClient,
  owner: string,
  type: string,
  cursor?: string,
): Promise<string | null> => {
  const res = await provider.listOwnedObjects({ owner, cursor: cursor || null });

  const object = res.objects.find((d) => isSameType(d.type || "", type));
  if (!object && res.hasNextPage) {
    return getOwnedObjectIdPaginated(provider, owner, type, res.cursor as string);
  } else if (!object && !res.hasNextPage) {
    return null;
  } else {
    return object?.objectId ?? null;
  }
};

export const getUpgradeCapObjectId = async (
  provider: SuiGrpcClient,
  owner: string,
  packageId: string,
): Promise<string | null> => {
  const res = await provider.listOwnedObjects({
    owner,
    type: normalizeSuiType(UPGRADE_CAP_TYPE),
    include: { json: true },
  });

  const objects = res.objects.filter((o) => {
    const fields = getFieldsFromObjectResponse(o);
    return (
      isMoveStructObject(fields) &&
      normalizeSuiAddress(fields["package"] as string) === normalizeSuiAddress(packageId)
    );
  });

  if (objects.length === 0) return null;

  if (objects.length === 1) {
    // We've found the object we're looking for
    return objects[0]!.objectId ?? null;
  } else {
    const objectsStr = JSON.stringify(objects, null, 2);
    throw new Error(
      `Found multiple upgrade capabilities owned by ${owner} from package ${packageId}. Objects: ${objectsStr}`,
    );
  }
};

// Create a TransactionBlock to publish a package
export const publishPackage = async (
  buildOutput: SuiBuildOutput,
  signerAddress: string,
): Promise<Transaction> => {
  const tx = new Transaction();
  const [upgradeCap] = tx.publish({
    modules: buildOutput.modules.map((m) => Array.from(encoding.b64.decode(m))),
    dependencies: buildOutput.dependencies.map((d) => normalizeSuiObjectId(d)),
  });
  // Transfer upgrade capability to recipient
  tx.transferObjects([upgradeCap!], tx.pure.address(signerAddress));
  return tx;
};

export const newEmitterCap = (
  coreBridgePackageId: string,
  coreBridgeStateObjectId: string,
  owner: string,
): Transaction => {
  const tx = new Transaction();
  const [emitterCap] = tx.moveCall({
    target: `${coreBridgePackageId}::emitter::new`,
    arguments: [tx.object(coreBridgeStateObjectId)],
  });
  tx.transferObjects([emitterCap!], tx.pure.address(owner));
  return tx;
};
