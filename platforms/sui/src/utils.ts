import { bcs } from "@mysten/sui.js/bcs";
import type { PaginatedObjectsResponse, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { isValidSuiAddress, normalizeSuiAddress, normalizeSuiObjectId } from "@mysten/sui.js/utils";

import { encoding } from "@wormhole-foundation/sdk-connect";
import type { SuiBuildOutput } from "./types.js";
import {
  getFieldsFromObjectResponse,
  isMoveStructObject,
  isMoveStructStruct,
  isSameType,
} from "./types.js";
import { getPackageIdFromType, normalizeSuiType } from "./address.js";

export const UPGRADE_CAP_TYPE = "0x2::package::UpgradeCap";

const MAX_PURE_ARGUMENT_SIZE = 16 * 1024;
export const uint8ArrayToBCS = (arr: Uint8Array) =>
  bcs.ser("vector<u8>", arr, { maxSize: MAX_PURE_ARGUMENT_SIZE }).toBytes();

//
// Utils to fetch data from Sui
//

export const getOriginalPackageId = async (provider: SuiClient, stateObjectId: string) => {
  const { data, error } = await provider.getObject({
    id: stateObjectId,
    options: { showContent: true },
  });
  if (error) throw new Error("Error getting object: " + error);

  if (!data || !isMoveStructStruct(data.content))
    throw new Error(`Cannot get oject for state id ${stateObjectId}: ` + data);

  return getPackageIdFromType(data.content.type);
};

export const getObjectFields = async (
  provider: SuiClient,
  objectId: string,
): Promise<Record<string, any> | null> => {
  if (!isValidSuiAddress(objectId)) {
    throw new Error(`Invalid object ID: ${objectId}`);
  }
  const res = await provider.getObject({
    id: objectId,
    options: {
      showContent: true,
    },
  });
  return getFieldsFromObjectResponse(res);
};

export const getPackageId = async (provider: SuiClient, objectId: string): Promise<string> => {
  let currentPackage: { objectId: string; name: any } | undefined;
  let nextCursor;
  do {
    const dynamicFields = await provider.getDynamicFields({
      parentId: objectId,
      cursor: nextCursor,
    });
    currentPackage = dynamicFields.data.find((field) => field.name.type.endsWith("CurrentPackage"));
    nextCursor = dynamicFields.hasNextPage ? dynamicFields.nextCursor : null;
  } while (nextCursor && !currentPackage);

  if (!currentPackage) throw new Error("CurrentPackage not found");

  const obj = await provider.getObject({
    id: currentPackage.objectId,
    options: {
      showContent: true,
    },
  });

  const fields = getFieldsFromObjectResponse(obj);

  if (!fields || !isMoveStructObject(fields))
    throw new Error("Unable to get fields from object response");

  if (!("value" in fields) || !isMoveStructStruct(fields["value"]))
    throw new Error("Unable to get package id");

  return fields["value"].fields["package"]! as string;
};

export const getOldestEmitterCapObjectId = async (
  provider: SuiClient,
  coreBridgePackageId: string,
  owner: string,
): Promise<string | null> => {
  let oldestVersion: string | null = null;
  let oldestObjectId: string | null = null;
  let response: PaginatedObjectsResponse | null = null;
  let nextCursor;
  do {
    response = await provider.getOwnedObjects({
      owner,
      filter: {
        StructType: `${coreBridgePackageId}::emitter::EmitterCap`,
      },
      options: {
        showContent: true,
      },
      cursor: nextCursor,
    });

    if (!response || !response.data) {
      throw Error("Failed to get owned objects");
    }

    for (const objectResponse of response.data) {
      if (!objectResponse.data) continue;
      const { version, objectId } = objectResponse.data;
      if (oldestVersion === null || version < oldestVersion) {
        oldestVersion = version;
        oldestObjectId = objectId;
      }
    }
    nextCursor = response.hasNextPage ? response.nextCursor : undefined;
  } while (nextCursor);
  return oldestObjectId;
};

export const getOwnedObjectId = async (
  provider: SuiClient,
  owner: string,
  type: string,
): Promise<string | null> => {
  // Upgrade caps are a special case
  if (isSameType(type, UPGRADE_CAP_TYPE)) {
    throw new Error(
      "`getOwnedObjectId` should not be used to get the object ID of an `UpgradeCap`. Use `getUpgradeCapObjectId` instead.",
    );
  }

  try {
    const res = await provider.getOwnedObjects({
      owner,
      filter: { StructType: type },
      options: {
        showContent: true,
      },
    });
    if (!res || !res.data) {
      throw new Error("Failed to get owned objects");
    }

    const objects = res.data.filter((o) => o.data?.objectId);
    if (!objects || objects.length === 0) return null;
    if (objects.length === 1) {
      return objects[0]!.data?.objectId ?? null;
    } else {
      const objectsStr = JSON.stringify(objects, null, 2);
      throw new Error(
        `Found multiple objects owned by ${owner} of type ${type}. This may mean that we've received an unexpected response from the Sui RPC and \`worm\` logic needs to be updated to handle this. Objects: ${objectsStr}`,
      );
    }
  } catch (error) {
    // Handle 504 error by using findOwnedObjectByType method
    const is504HttpError = `${error}`.includes("504 Gateway Time-out");
    if (error && is504HttpError) {
      return getOwnedObjectIdPaginated(provider, owner, type);
    } else {
      throw error;
    }
  }
};

export const getOwnedObjectIdPaginated = async (
  provider: SuiClient,
  owner: string,
  type: string,
  cursor?: string,
): Promise<string | null> => {
  const res: PaginatedObjectsResponse = await provider.getOwnedObjects({
    owner,
    filter: undefined, // Filter must be undefined to avoid 504 responses
    cursor: cursor || undefined,
    options: {
      showType: true,
    },
  });

  if (!res || !res.data) {
    throw new Error("Could not fetch owned object id");
  }

  const object = res.data.find((d) => isSameType(d.data?.type || "", type));
  if (!object && res.hasNextPage) {
    return getOwnedObjectIdPaginated(provider, owner, type, res.nextCursor as string);
  } else if (!object && !res.hasNextPage) {
    return null;
  } else {
    return object?.data?.objectId ?? null;
  }
};

export const getUpgradeCapObjectId = async (
  provider: SuiClient,
  owner: string,
  packageId: string,
): Promise<string | null> => {
  const res = await provider.getOwnedObjects({
    owner,
    filter: { StructType: normalizeSuiType(UPGRADE_CAP_TYPE) },
    options: {
      showContent: true,
    },
  });
  if (!res || !res.data) {
    throw new Error("Failed to get upgrade caps");
  }

  const objects = res.data.filter((o) => {
    const fields = getFieldsFromObjectResponse(o);

    return (
      isMoveStructStruct(fields) &&
      normalizeSuiAddress(fields.fields["package"]! as string) === normalizeSuiAddress(packageId)
    );
  });

  if (!objects || objects.length === 0) return null;

  if (objects.length === 1) {
    // We've found the object we're looking for
    return objects[0]!.data?.objectId ?? null;
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
): Promise<TransactionBlock> => {
  const tx = new TransactionBlock();
  const [upgradeCap] = tx.publish({
    modules: buildOutput.modules.map((m) => Array.from(encoding.b64.decode(m))),
    dependencies: buildOutput.dependencies.map((d) => normalizeSuiObjectId(d)),
  });
  // Transfer upgrade capability to recipient
  tx.transferObjects([upgradeCap!], tx.pure(signerAddress));
  return tx;
};

export const newEmitterCap = (
  coreBridgePackageId: string,
  coreBridgeStateObjectId: string,
  owner: string,
): TransactionBlock => {
  const tx = new TransactionBlock();
  const [emitterCap] = tx.moveCall({
    target: `${coreBridgePackageId}::emitter::new`,
    arguments: [tx.object(coreBridgeStateObjectId)],
  });
  tx.transferObjects([emitterCap!], tx.pure(owner));
  return tx;
};
