import type { MapLevels } from "./../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

export type ExecutorTokenBridgeContracts = {
  relayer: string;
  relayerWithReferrer?: string;
};

// prettier-ignore
export const executorTokenBridgeContracts = [[
  "Mainnet", [
    ["Arbitrum",        { relayer: "0x04C98824a64d75CD1E9Bc418088b4c9A99048153", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Avalanche",       { relayer: "0x8849F05675E034b54506caB84450c8C82694a786", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Base",            { relayer: "0xD8B736EF27Fc997b1d00F22FE37A58145D3BDA07", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Berachain",       { relayer: "0xFAeFa20CB3759AEd2310E25015F05d62D8567A3F", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Bsc",             { relayer: "0x2513515340fF71DD5AF02fC1BdB9615704d91524", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Celo",            { relayer: "0xe478DEe705BEae591395B08934FA19F54df316BE", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Ethereum",        { relayer: "0xa8969F3f8D97b3Ed89D4e2EC19B6B0CfD504b212", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Ink",             { relayer: "0x4bFB47F4c8A904d2C24e73601D175FE3a38aAb5B", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Moonbeam",        { relayer: "0xF6b9616C63Fa48D07D82c93CE02B5d9111c51a3d", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Optimism",        { relayer: "0x37aC29617AE74c750a1e4d55990296BAF9b8De73", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Polygon",         { relayer: "0x1d98CA4221516B9ac4869F5CeA7E6bb9C41609D6", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Scroll",          { relayer: "0x05129e142e7d5A518D81f19Db342fBF5f7E26A18", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Seievm",          { relayer: "0x7C129bc8F6188d12c0d1BBDE247F134148B97618", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Solana",          { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["Unichain",        { relayer: "0x9Bca817F67f01557aeD615130825A28F4C5f3b87", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Worldchain",      { relayer: "0xc0565Bd29b34603C0383598E16843d95Ae9c4f65", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["XRPLEVM",         { relayer: "0x37bCc9d175124F77Bfce68589d2a8090eF846B85", relayerWithReferrer: "0x13a35c075D6Acc1Fb9BddFE5FE38e7672789e4db" }],
    ["Monad",           { relayer: "0xf7E051f93948415952a2239582823028DacA948e", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Fogo",            { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
  ]], [
  "Testnet", [
    ["Avalanche",       { relayer: "0x10Ce9a35883C44640e8B12fea4Cc1e77F77D8c52", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["BaseSepolia",     { relayer: "0x523d25D33B975ad72283f73B1103354352dBCBb8", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Bsc",             { relayer: "0x26e7e3869b781f360A108728EE8391Cee6051E17", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Fogo",            { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["Monad",           { relayer: "0x5Ba2c39cF0624BB5fBe94E919519aEA0DdD68454", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["OptimismSepolia",  { relayer: "0xD9AA4f8Ac271B3149b8C3d1D0f999Ef7cb9af9EC", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["PolygonSepolia",  { relayer: "0xC5c0bF6A8419b3d47150B2a6146b7Ed598C9d736", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Sepolia",         { relayer: "0xb0b2119067cF04fa959f654250BD49fE1BD6F53c", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Seievm",          { relayer: "0x595712bA7e4882af338d60ae37058082a5d0331A", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
    ["Solana",          { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["XRPLEVM",         { relayer: "0xb00224c60fe6ab134c8544dc29350286545f8dcc", relayerWithReferrer: "0x17CFAAf9e8a5ABb1eee758dB9040F945c9EAC907" }],
    ["Mezo",            { relayer: "0x2002a44b1106DF83671Fb419A2079a75e2a34808", relayerWithReferrer: "0x412f30e9f8B4a1e99eaE90209A6b00f5C3cc8739" }],
  ]],
] as const satisfies MapLevels<[Network, Chain, ExecutorTokenBridgeContracts]>;
