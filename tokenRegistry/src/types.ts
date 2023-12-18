import { Chain } from "@wormhole-foundation/sdk-base";

export type ForeignAssetCache = {
  address: string;
  decimals: number;
};
export type ForeignAssetsCache = {
  [chain in Chain]?: ForeignAssetCache;
};

export type TokenConfig = {
  name: string;
  symbol: string;
  nativeChain: Chain;
  decimals: number;
  foreignAssets?: ForeignAssetsCache;
};

export type TokenEntries = {
  [key: string]: TokenConfig;
};

export type TokensConfig = {
  [chain in Chain]?: TokenEntries;
};
