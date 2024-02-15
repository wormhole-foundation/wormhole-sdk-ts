import {
  JsonRpcProvider,
  PaginatedObjectsResponse,
  SuiObjectResponse,
  TransactionBlock,
  builder,
  getObjectType,
  isValidSuiAddress,
  normalizeSuiObjectId,
} from "@mysten/sui.js";
import { encoding } from "@wormhole-foundation/connect-sdk";
import { SuiBuildOutput, isValidSuiType, trimSuiType } from "./types";

const MAX_PURE_ARGUMENT_SIZE = 16 * 1024;

export const uint8ArrayToBCS = (arr: Uint8Array) =>
  builder.ser("vector<u8>", arr, { maxSize: MAX_PURE_ARGUMENT_SIZE }).toBytes();

export const publishPackage = async (
  buildOutput: SuiBuildOutput,
  signerAddress: string,
): Promise<TransactionBlock> => {
  // Publish contracts
  const tx = new TransactionBlock();
  const [upgradeCap] = tx.publish({
    modules: buildOutput.modules.map((m) => Array.from(encoding.b64.decode(m))),
    dependencies: buildOutput.dependencies.map((d) => normalizeSuiObjectId(d)),
  });
  // Transfer upgrade capability to recipient
  tx.transferObjects([upgradeCap!], tx.pure(signerAddress));
  return tx;
};

export const getOriginalPackageId = async (provider: JsonRpcProvider, stateObjectId: string) => {
  return getObjectType(
    await provider.getObject({
      id: stateObjectId,
      options: { showContent: true },
    }),
  )?.split("::")[0];
};

export const getPackageIdFromType = (type: string): string | null => {
  if (!isValidSuiType(type)) return null;
  const packageId = type.split("::")[0];
  if (!packageId || !isValidSuiAddress(packageId)) return null;
  return packageId;
};

/**
 * Get the fully qualified type of a wrapped asset published to the given
 * package ID.
 *
 * All wrapped assets that are registered with the token bridge must satisfy
 * the requirement that module name is `coin` (source: https://github.com/wormhole-foundation/wormhole/blob/a1b3773ee42507122c3c4c3494898fbf515d0712/sui/token_bridge/sources/create_wrapped.move#L88).
 * As a result, all wrapped assets share the same module name and struct name,
 * since the struct name is necessarily `COIN` since it is a OTW.
 * @param coinPackageId packageId of the wrapped asset
 * @returns Fully qualified type of the wrapped asset
 */
export const getWrappedCoinType = (coinPackageId: string): string => {
  if (!isValidSuiAddress(coinPackageId)) throw new Error(`Invalid package ID: ${coinPackageId}`);
  return `${coinPackageId}::coin::COIN`;
};

export const getFieldsFromObjectResponse = (object: SuiObjectResponse) => {
  const content = object.data?.content;
  return content && content.dataType === "moveObject" ? content.fields : null;
};

export const getObjectFields = async (
  provider: JsonRpcProvider,
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

export const getTableKeyType = (tableType: string): string | null => {
  if (!tableType) return null;
  const match = trimSuiType(tableType).match(/0x2::table::Table<(.*)>/);
  if (!match) return null;
  const [keyType] = match[1]!.split(",");
  if (!isValidSuiType(keyType!)) return null;
  return keyType ? keyType : null;
};

/**
 * @param provider
 * @param objectId Core or token bridge state object ID
 * @returns The latest package ID for the provided state object
 */
export async function getPackageId(provider: JsonRpcProvider, objectId: string): Promise<string> {
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

  const packageId =
    obj.data?.content && "fields" in obj.data.content
      ? obj.data.content.fields["value"]?.fields?.package
      : null;

  if (!packageId) throw new Error("Unable to get current package");

  return packageId;
}

/**
 * Create a new EmitterCap object owned by owner.
 * @returns The created EmitterCap object ID
 */
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

export const getOldestEmitterCapObjectId = async (
  provider: JsonRpcProvider,
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
