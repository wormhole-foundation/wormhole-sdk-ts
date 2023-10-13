// patch out annoying logs
const info = console.info;
console.info = function (x: any, ...rest: any) {
  if (x !== 'secp256k1 unavailable, reverting to browser version') {
    info(x, ...rest);
  }
};
const warn = console.warn;
console.warn = function (x: any, ...rest: any) {
  if (
    !x
      .toString()
      .startsWith(
        'Error: Error: RPC Validation Error: The response returned from RPC server does not match the TypeScript definition. This is likely because the SDK version is not compatible with the RPC server.',
      )
  ) {
    warn(x, ...rest);
  }
};

import { ChainName, chains } from "@wormhole-foundation/sdk-base";
import { ForeignAssetsCache, TokensConfig } from "./types";
import { TokenId, Wormhole, toNative } from "@wormhole-foundation/connect-sdk";

// TODO: Question: How do we handle if a user tries to perform an action for a chain/platform which isn't installed??
// const supportedPlatforms: PlatformName[] = ['Evm', 'Solana'];
const supportedChains: ChainName[] = ['Ethereum', 'Polygon', 'Celo', 'Moonbeam', 'Fantom', 'Avalanche', 'Bsc', 'Optimism', 'Arbitrum', 'Solana']

export const isSupportedChain = (chain: ChainName) => {
  return supportedChains.includes(chain);
}

export const createTokenId = (chain: ChainName, address: string) => {
  if (!isSupportedChain(chain)) return;
  return {
    chain,
    address: toNative(chain, address),
  }
}

export const getForeignAddress = async (wh: Wormhole, chain: ChainName, tokenId: TokenId) => {
  if (!isSupportedChain(chain)) return;
  let foreignAddress: string | null = null;
  try {
    const foreignId = await wh.getWrappedAsset(chain, tokenId);
    foreignAddress = foreignId.address.toString();
  } catch (e: any) {
    if (
      e?.message === '3104 RPC not configured' ||
      e?.message === 'wormchain RPC not configured'
    ) {
      // do not throw on wormchain errors
    } else if (e?.message.includes('is not a wrapped asset')) {
      // do not throw if wrapped asset does not exist
    } else {
      // log error but keep going
      console.error(e)
    }
  }
  return foreignAddress;
}

export const getForeignAssetsData = async (wh: Wormhole, chain: ChainName, tokenId: TokenId | undefined, foreignAssetsCache: ForeignAssetsCache | undefined) => {
  if (!tokenId) return;
  let updates: ForeignAssetsCache = {};
  for (const foreignChain of chains) {
    const isSupported = isSupportedChain(foreignChain);
    if (foreignChain !== tokenId.chain && isSupported) {
      const configForeignAddress = foreignAssetsCache ? foreignAssetsCache[foreignChain] : undefined;
      const foreignAddress = await getForeignAddress(wh, foreignChain, tokenId);
      if (foreignAddress) {
        const foreignDecimals = await wh.getDecimals(
          foreignChain,
          toNative(foreignChain, foreignAddress),
        );
        if (configForeignAddress) {
          if (configForeignAddress.address !== foreignAddress) {
            throw new Error(
              `❌ Invalid foreign address detected! Env: ${wh.conf.network}, Existing Address: ${configForeignAddress.address}, Chain: ${chain}, Expected: ${foreignAddress}, Received: ${configForeignAddress.address}`,
            );
          } else if (configForeignAddress.decimals !== Number(foreignDecimals)) {
            throw new Error(
              `❌ Invalid foreign decimals detected! Env: ${wh.conf.network}, Existing Address: ${configForeignAddress.address}, Chain: ${chain}, Expected: ${foreignDecimals}, Received: ${configForeignAddress.decimals}`,
            );
          } else {
            // console.log('✅ Config matches');
          }
        } else {
          const update = {
            [foreignChain]: {
              address: foreignAddress,
              decimals: Number(foreignDecimals)
            }
          }
          updates = { ...updates, ...update }
        }
      }
    }
  }
  return updates;
}

export const getSuggestedUpdates = async (wh: Wormhole, tokensConfig: TokensConfig) => {
  let suggestedUpdates: TokensConfig = {};
  let numUpdates = 0;

  for (const [chain, chainTokensConfig] of Object.entries(tokensConfig)) {
    for (const [token, config] of Object.entries(chainTokensConfig)) {
      const tokenId = createTokenId(chain as ChainName, token);
      const updates = await getForeignAssetsData(wh, chain as ChainName, tokenId, config.foreignAssets);
      if (updates && Object.values(updates).length > 0) {
        numUpdates += Object.values(updates).length;
        suggestedUpdates = {
          ...suggestedUpdates,
          [chain]: {
            ...(suggestedUpdates[chain as ChainName] || {}),
            [token]: {
              ...(suggestedUpdates[chain as ChainName] ? suggestedUpdates[chain as ChainName]![token] || {} : {}),
              foreignAssets: {
                ...(suggestedUpdates[chain as ChainName] ? suggestedUpdates[chain as ChainName]![token] ? suggestedUpdates[chain as ChainName]![token]!.foreignAssets : {} : {}),
                ...updates,
              }
            }
          }
        }
      }
    }
  }
  // console.log(`${numUpdates} updates available`);
  // console.log(JSON.stringify(suggestedUpdates, null, 4));
  return [numUpdates, suggestedUpdates];
}
