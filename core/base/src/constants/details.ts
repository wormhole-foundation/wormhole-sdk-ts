import { Chain } from "./chains";

type ChainDetails = {
  finalityThreshold: number;
  nativeTokenDecimals: number;
};

export const MainnetDetails: Record<string, ChainDetails> = {
  Ethereum: {
    finalityThreshold: 64,
    nativeTokenDecimals: 18,
  },
  Solana: {
    finalityThreshold: 32,
    nativeTokenDecimals: 9,
  },
  Polygon: {
    finalityThreshold: 512,
    nativeTokenDecimals: 18,
  },
  Bsc: {
    finalityThreshold: 15,
    nativeTokenDecimals: 18,
  },
  Avalanche: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Fantom: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Celo: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Moonbeam: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Sui: {
    finalityThreshold: 0,
    nativeTokenDecimals: 9,
  },
  Aptos: {
    finalityThreshold: 0,
    nativeTokenDecimals: 8,
  },
  Sei: {
    finalityThreshold: 0,
    nativeTokenDecimals: 6,
  },
};

export const TestnetDetails: Record<string, ChainDetails> = {
  Ethereum: {
    finalityThreshold: 64,
    nativeTokenDecimals: 18,
  },
  Solana: {
    finalityThreshold: 32,
    nativeTokenDecimals: 9,
  },
  Polygon: {
    finalityThreshold: 64,
    nativeTokenDecimals: 18,
  },
  Bsc: {
    finalityThreshold: 15,
    nativeTokenDecimals: 18,
  },
  Avalanche: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Fantom: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Celo: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Moonbeam: {
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  Sui: {
    finalityThreshold: 0,
    nativeTokenDecimals: 9,
  },
  Aptos: {
    finalityThreshold: 0,
    nativeTokenDecimals: 8,
  },
  Sei: {
    finalityThreshold: 0,
    nativeTokenDecimals: 6,
  },
};
