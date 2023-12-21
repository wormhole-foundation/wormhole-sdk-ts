// patch out annoying logs
const info = console.info;
console.info = function (x: any, ...rest: any) {
  if (x !== "secp256k1 unavailable, reverting to browser version") {
    info(x, ...rest);
  }
};
const warn = console.warn;
console.warn = function (x: any, ...rest: any) {
  if (
    !x
      .toString()
      .startsWith(
        "Error: Error: RPC Validation Error: The response returned from RPC server does not match the TypeScript definition. This is likely because the SDK version is not compatible with the RPC server.",
      )
  ) {
    warn(x, ...rest);
  }
};

import { Chain, Network, chains } from "@wormhole-foundation/sdk-base";
import { ForeignAssetsCache, TokenEntries, TokensConfig } from "../types";
import { TokenId, Wormhole, toNative } from "@wormhole-foundation/connect-sdk";

// TODO: Question: How do we handle if a user tries to perform an action for a chain/platform which isn't installed??
// const supportedPlatforms: Platform[] = ['Evm', 'Solana'];
const supportedChains: Chain[] = [
  "Ethereum",
  "Polygon",
  "Celo",
  "Moonbeam",
  "Fantom",
  "Avalanche",
  "Bsc",
  "Optimism",
  "Arbitrum",
  "Solana",
];

export const isSupportedChain = (chain: Chain) => {
  return supportedChains.includes(chain);
};

export const createTokenId = (chain: Chain, address: string) => {
  if (!isSupportedChain(chain)) return undefined;
  return Wormhole.chainAddress(chain, address);
};

export const getForeignAddress = async (wh: Wormhole<Network>, chain: Chain, tokenId: TokenId) => {
  if (!isSupportedChain(chain)) return undefined;
  let foreignAddress: string | null = null;
  try {
    const foreignId = await wh.getWrappedAsset(chain, tokenId);
    foreignAddress = foreignId.address.toString();
  } catch (e: any) {
    if (e?.message === "3104 RPC not configured" || e?.message === "wormchain RPC not configured") {
      // do not throw on wormchain errors
    } else if (e?.message.includes("is not a wrapped asset")) {
      // do not throw if wrapped asset does not exist
    } else {
      // log error but keep going
      console.error(e);
    }
  }
  return foreignAddress;
};

export const getForeignAssetsData = async (
  wh: Wormhole<Network>,
  chain: Chain,
  tokenId: TokenId,
  foreignAssetsCache: ForeignAssetsCache | undefined,
) => {
  let updates: ForeignAssetsCache = {};
  for (const foreignChain of chains) {
    const isSupported = isSupportedChain(foreignChain);
    if (foreignChain !== tokenId.chain && isSupported) {
      const configForeignAddress = foreignAssetsCache
        ? foreignAssetsCache[foreignChain]
        : undefined;
      const foreignAddress = await getForeignAddress(wh, foreignChain, tokenId);
      if (foreignAddress) {
        const foreignDecimals = await wh.getDecimals(
          foreignChain,
          toNative(foreignChain, foreignAddress),
        );
        if (configForeignAddress) {
          if (configForeignAddress.address !== foreignAddress) {
            throw new Error(
              `❌ Invalid foreign address detected! Env: ${wh.network}, Existing Address: ${configForeignAddress.address}, Chain: ${chain}, Expected: ${foreignAddress}, Received: ${configForeignAddress.address}`,
            );
          } else if (configForeignAddress.decimals !== Number(foreignDecimals)) {
            throw new Error(
              `❌ Invalid foreign decimals detected! Env: ${wh.network}, Existing Address: ${configForeignAddress.address}, Chain: ${chain}, Expected: ${foreignDecimals}, Received: ${configForeignAddress.decimals}`,
            );
          } else {
            // console.log('✅ Config matches');
          }
        } else {
          const update = {
            [foreignChain]: {
              address: foreignAddress,
              decimals: Number(foreignDecimals),
            },
          };
          updates = { ...updates, ...update };
        }
      }
    }
  }
  return updates;
};

type MaybeUpdate = [Chain, string, ForeignAssetsCache | undefined];

export const getForeignAssetsDataForChain = async (
  wh: Wormhole<Network>,
  chain: Chain,
  chainTokensConfig: TokenEntries,
) => {
  console.log("Checking chain", chain);
  const maybeUpdates: MaybeUpdate[] = [];
  for (const [token, config] of Object.entries(chainTokensConfig)) {
    const tokenId = createTokenId(chain, token);
    if (!tokenId) continue;

    if (wh.network === "Mainnet" && tokenId.chain === "Solana") {
      // sleep to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    }

    try {
      const updates = await getForeignAssetsData(wh, chain, tokenId, config.foreignAssets);
      maybeUpdates.push([chain, token, updates]);
    } catch (e) {
      console.error(e);
    }
  }
  return maybeUpdates;
};

export const getSuggestedUpdates = async (wh: Wormhole<Network>, tokensConfig: TokensConfig) => {
  let suggestedUpdates: TokensConfig = {};
  let numUpdates = 0;

  // Get updates for each chain concurrently
  const maybeUpdates: MaybeUpdate[] = (
    await Promise.all(
      Object.entries(tokensConfig).map(([chain, chainTokensConfig]) =>
        getForeignAssetsDataForChain(wh, chain as Chain, chainTokensConfig),
      ),
    )
  ).flat();

  for (const [chain, token, updates] of maybeUpdates) {
    if (!updates || Object.values(updates).length == 0) continue;
    numUpdates += Object.values(updates).length;

    suggestedUpdates = {
      ...suggestedUpdates,
      [chain]: {
        ...(suggestedUpdates[chain] || {}),
        [token]: {
          ...(suggestedUpdates[chain] ? suggestedUpdates[chain]![token] || {} : {}),
          foreignAssets: {
            ...(suggestedUpdates[chain]
              ? suggestedUpdates[chain]![token]
                ? suggestedUpdates[chain]![token]!.foreignAssets
                : {}
              : {}),
            ...updates,
          },
        },
      },
    };
  }

  return [numUpdates, suggestedUpdates];
};
