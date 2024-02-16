import { bcs } from "@mysten/sui.js/bcs";
import { PaginatedObjectsResponse, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { isValidSuiAddress, normalizeSuiObjectId } from "@mysten/sui.js/utils";

import { encoding } from "@wormhole-foundation/connect-sdk";
import {
  SuiBuildOutput,
  getFieldsFromObjectResponse,
  getPackageIdFromType,
  isMoveStructObject,
  isMoveStructStruct,
} from "./types";

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

export async function getPackageId(provider: SuiClient, objectId: string): Promise<string> {
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
}

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
