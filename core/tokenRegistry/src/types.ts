import { ChainName } from "@wormhole-foundation/sdk-base";

export type ForeignAssetCache = {
  address: string;
  decimals: number;
};
export type ForeignAssetsCache = {
  [chain in ChainName]?: ForeignAssetCache;
};

export type TokenConfig = {
  symbol: string;
  nativeChain: ChainName;
  decimals: number;
  foreignAssets?: ForeignAssetsCache;
}
export type TokensConfig = {
  [chain in ChainName]?: { [key: string]: TokenConfig }
};
