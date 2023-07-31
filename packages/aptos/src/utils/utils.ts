import { AptosAccount, AptosClient, HexString, TokenTypes } from 'aptos';
import { hexZeroPad } from 'ethers/lib/utils';
import { sha3_256 } from 'js-sha3';
import {
  hex,
  ensureHexPrefix,
  ChainId,
  MAINNET_CHAINS,
} from '@wormhole-foundation/connect-sdk';
import { NftBridgeState, TokenBridgeState } from '../types';

/**
 * Test if given string is a valid fully qualified type of moduleAddress::moduleName::structName.
 * @param str String to test
 * @returns Whether or not given string is a valid type
 */
export const isValidAptosType = (str: string): boolean =>
  /^(0x)?[0-9a-fA-F]+::\w+::\w+$/.test(str);

/**
 * Given a hash, returns the fully qualified type by querying the corresponding TypeInfo.
 * @param client Client used to transfer data to/from Aptos node
 * @param tokenBridgeAddress Address of token bridge
 * @param fullyQualifiedTypeHash Hash of fully qualified type
 * @returns The fully qualified type associated with the given hash
 */
export async function getTypeFromExternalAddress(
  client: AptosClient,
  tokenBridgeAddress: string,
  fullyQualifiedTypeHash: string,
): Promise<string | null> {
  // get handle
  tokenBridgeAddress = ensureHexPrefix(tokenBridgeAddress);
  const state = (
    await client.getAccountResource(
      tokenBridgeAddress,
      `${tokenBridgeAddress}::state::State`,
    )
  ).data as TokenBridgeState;
  const handle = state.native_infos.handle;

  try {
    // get type info
    const typeInfo = await client.getTableItem(handle, {
      key_type: `${tokenBridgeAddress}::token_hash::TokenHash`,
      value_type: '0x1::type_info::TypeInfo',
      key: { hash: fullyQualifiedTypeHash },
    });

    if (!typeInfo) {
      return null;
    }

    // construct type
    const moduleName = Buffer.from(
      typeInfo.module_name.substring(2),
      'hex',
    ).toString('ascii');
    const structName = Buffer.from(
      typeInfo.struct_name.substring(2),
      'hex',
    ).toString('ascii');
    return `${typeInfo.account_address}::${moduleName}::${structName}`;
  } catch {
    return null;
  }
}

/**
 * Get creator address, collection name, token name, and property version from
 * a token hash. Note that this method is meant to be used for native tokens
 * that have already been registered in the NFT bridge.
 *
 * The token hash is stored in the `tokenId` field of NFT transfer VAAs and
 * is calculated by the operations in `deriveTokenHashFromTokenId`.
 * @param client
 * @param nftBridgeAddress
 * @param tokenHash Token hash
 * @returns Token ID
 */
export const getTokenIdFromTokenHash = async (
  client: AptosClient,
  nftBridgeAddress: string,
  tokenHash: Uint8Array,
): Promise<TokenTypes.TokenId> => {
  const state = (
    await client.getAccountResource(
      nftBridgeAddress,
      `${nftBridgeAddress}::state::State`,
    )
  ).data as NftBridgeState;
  const handle = state.native_infos.handle;
  const { token_data_id, property_version } = (await client.getTableItem(
    handle,
    {
      key_type: `${nftBridgeAddress}::token_hash::TokenHash`,
      value_type: `0x3::token::TokenId`,
      key: {
        hash: HexString.fromUint8Array(tokenHash).hex(),
      },
    },
  )) as TokenTypes.TokenId & { __headers: unknown };
  return { token_data_id, property_version };
};

/**
 * Returns module address from given fully qualified type/module address.
 * @param str FQT or module address
 * @returns Module address
 */
export const coalesceModuleAddress = (str: string): string => {
  return str.split('::')[0];
};

/**
 * The NFT bridge creates resource accounts, which in turn create a collection
 * and mint a single token for each transferred NFT. This method derives the
 * address of that resource account from the given origin chain and address.
 * @param nftBridgeAddress
 * @param originChain
 * @param originAddress External address of NFT on origin chain
 * @returns Address of resource account
 */
export const deriveResourceAccountAddress = async (
  nftBridgeAddress: string,
  originChainId: ChainId,
  originAddress: Uint8Array,
): Promise<string | null> => {
  if (originChainId === MAINNET_CHAINS.aptos) {
    return null;
  }

  const chainId = Buffer.alloc(2);
  chainId.writeUInt16BE(originChainId);
  const seed = Buffer.concat([chainId, Buffer.from(originAddress)]);
  const resourceAccountAddress = await AptosAccount.getResourceAccountAddress(
    nftBridgeAddress,
    seed,
  );
  return resourceAccountAddress.toString();
};

/**
 * Derive the module address for an asset defined by the given origin chain and address.
 * @param tokenBridgeAddress Address of token bridge (32 bytes)
 * @param originChain Chain ID of chain that original asset is from
 * @param originAddress Native address of asset
 * @returns The module address for the given asset
 */
export const getForeignAssetAddress = (
  tokenBridgeAddress: string,
  originChain: ChainId,
  originAddress: string,
): string | null => {
  if (originChain === MAINNET_CHAINS.aptos) {
    return null;
  }

  // from https://github.com/aptos-labs/aptos-core/blob/25696fd266498d81d346fe86e01c330705a71465/aptos-move/framework/aptos-framework/sources/account.move#L90-L95
  const DERIVE_RESOURCE_ACCOUNT_SCHEME = Buffer.alloc(1);
  DERIVE_RESOURCE_ACCOUNT_SCHEME.writeUInt8(255);

  let chain: Buffer = Buffer.alloc(2);
  chain.writeUInt16BE(originChain);
  return sha3_256(
    Buffer.concat([
      hex(hexZeroPad(ensureHexPrefix(tokenBridgeAddress), 32)),
      chain,
      Buffer.from('::', 'ascii'),
      hex(hexZeroPad(ensureHexPrefix(originAddress), 32)),
      DERIVE_RESOURCE_ACCOUNT_SCHEME,
    ]),
  );
};

/**
 * Derives the fully qualified type of the asset defined by the given origin chain and address.
 * @param tokenBridgeAddress Address of token bridge (32 bytes)
 * @param originChain Chain ID of chain that original asset is from
 * @param originAddress Native address of asset; if origin chain ID is 22 (Aptos), this is the
 * asset's fully qualified type
 * @returns The fully qualified type on Aptos for the given asset
 */
export const getAssetFullyQualifiedType = (
  tokenBridgeAddress: string,
  originChain: ChainId,
  originAddress: string,
): string | null => {
  // native asset
  if (originChain === MAINNET_CHAINS.aptos) {
    // originAddress should be of form address::module::type
    if (!isValidAptosType(originAddress)) {
      console.error('Invalid qualified type');
      return null;
    }

    return ensureHexPrefix(originAddress);
  }

  // non-native asset, derive unique address
  const wrappedAssetAddress = getForeignAssetAddress(
    tokenBridgeAddress,
    originChain,
    originAddress,
  );
  return wrappedAssetAddress
    ? `${ensureHexPrefix(wrappedAssetAddress)}::coin::T`
    : null;
};
