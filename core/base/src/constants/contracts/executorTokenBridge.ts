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
    ["Arbitrum",        { relayer: "0x04C98824a64d75CD1E9Bc418088b4c9A99048153", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Avalanche",       { relayer: "0x8849F05675E034b54506caB84450c8C82694a786", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Base",            { relayer: "0xD8B736EF27Fc997b1d00F22FE37A58145D3BDA07", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Berachain",       { relayer: "0xFAeFa20CB3759AEd2310E25015F05d62D8567A3F", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Bsc",             { relayer: "0x2513515340fF71DD5AF02fC1BdB9615704d91524", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Celo",            { relayer: "0xe478DEe705BEae591395B08934FA19F54df316BE", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Ethereum",        { relayer: "0xa8969F3f8D97b3Ed89D4e2EC19B6B0CfD504b212", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Ink",             { relayer: "0x4bFB47F4c8A904d2C24e73601D175FE3a38aAb5B", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Moonbeam",        { relayer: "0xF6b9616C63Fa48D07D82c93CE02B5d9111c51a3d", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Optimism",        { relayer: "0x37aC29617AE74c750a1e4d55990296BAF9b8De73", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Polygon",         { relayer: "0x1d98CA4221516B9ac4869F5CeA7E6bb9C41609D6", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Seievm",          { relayer: "0x7C129bc8F6188d12c0d1BBDE247F134148B97618", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Solana",          { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["Unichain",        { relayer: "0x9Bca817F67f01557aeD615130825A28F4C5f3b87", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Worldchain",      { relayer: "0xc0565Bd29b34603C0383598E16843d95Ae9c4f65", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["XRPLEVM",         { relayer: "0x37bCc9d175124F77Bfce68589d2a8090eF846B85", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Monad",           { relayer: "0xf7E051f93948415952a2239582823028DacA948e", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Fogo",            { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["MegaETH",         { relayer: "0x4eEC1c908aD6e778664Efb03386C429fE5710D77", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
    ["Sui",             { relayer: "0x9b68b36399a3cd87680878d72253b3e8fdf82edb8ed74f7ec440b8bddd51f85d" }],
    ["ZeroGravity",     { relayer: "0x584e4FeCDfcCD40B1F6b091C3D91ad6201ccADFd", relayerWithReferrer: "0xee05C2e6075E2C86D1F5db4716Ff2A6c18889B20" }],
  ]], [
  "Testnet", [
    ["Avalanche",       { relayer: "0x10Ce9a35883C44640e8B12fea4Cc1e77F77D8c52", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["BaseSepolia",     { relayer: "0x523d25D33B975ad72283f73B1103354352dBCBb8", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Bsc",             { relayer: "0x26e7e3869b781f360A108728EE8391Cee6051E17", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Fogo",            { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["Linea",           { relayer: "0x1C5CC8522b5eE1e528159989A163167bC9264D07", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Moca",            { relayer: "0x36b91D24BAba19Af3aD1b5D5E2493A571044f14F", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["MonadTestnet",    { relayer: "0x03D9739c91a26d30f4B35f7e55B9FF995ef13dDb", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["OptimismSepolia", { relayer: "0xD9AA4f8Ac271B3149b8C3d1D0f999Ef7cb9af9EC", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["PolygonSepolia",  { relayer: "0xC5c0bF6A8419b3d47150B2a6146b7Ed598C9d736", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Sepolia",         { relayer: "0xb0b2119067cF04fa959f654250BD49fE1BD6F53c", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Seievm",          { relayer: "0x595712bA7e4882af338d60ae37058082a5d0331A", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Solana",          { relayer: "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf" }],
    ["Unichain",        { relayer: "0x74D37B2bcD2f8CaB6409c5a5f81C8cF5b4156963", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["XRPLEVM",         { relayer: "0xb00224c60fe6ab134c8544dc29350286545f8dcc", relayerWithReferrer: "0x06Bc50Cf4768929465E07199567B36Da6C74808c" }],
    ["Mezo",            { relayer: "0x2002a44b1106DF83671Fb419A2079a75e2a34808", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
    ["Sui",             { relayer: "0xb4b86c12d4ee0a813d976fb452b7afb325a2b381d00ccb2e54c5342f5ef2e684" }],
    ["ZeroGravity",     { relayer: "0x57188fC61ce92c8E941504562811660Ab883E895", relayerWithReferrer: "0xA4918ee5910679aed9Aa8fb2e1241dAae8AE0Aa0" }],
  ]],
] as const satisfies MapLevels<[Network, Chain, ExecutorTokenBridgeContracts]>;
