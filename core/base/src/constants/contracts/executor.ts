import type { MapLevels } from "./../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

// prettier-ignore
export const executorContracts = [[
  "Mainnet", [
    ["Aptos",           "0x11aa75c059e1a7855be66b931bf340a2e0973274ac16b5f519c02ceafaf08a18"],
    ["Arbitrum",        "0x3980f8318fc03d79033Bbb421A622CDF8d2Eeab4"],
    ["Avalanche",       "0x4661F0E629E4ba8D04Ee90080Aee079740B00381"],
    ["Base",            "0x9E1936E91A4a5AE5A5F75fFc472D6cb8e93597ea"],
    ["Berachain",       "0x0Dd7a5a32311b8D87A615Cc7f079B632D3d5e2D3"],
    ["Bsc",             "0xeC8cCCD058DbF28e5D002869Aa9aFa3992bf4ee0"],
    ["Celo",            "0xe6Ea5087c6860B94Cf098a403506262D8F28cF05"],
    ["Ethereum",        "0x84EEe8dBa37C36947397E1E11251cA9A06Fc6F8a"],
    ["HyperEVM",        "0xd7717899cc4381033Bc200431286D0AC14265F78"],
    // ["HyperCore",       "not-implemented"],
    ["Ink",             "0x3e44a5F45cbD400acBEF534F51e616043B211Ddd"],
    ["Linea",           "0x23aF2B5296122544A9A7861da43405D5B15a9bD3"],
    ["Mezo",            "0x0f9b8E144Cc5C5e7C0073829Afd30F26A50c5606"],
    ["Moonbeam",        "0x85D06449C78064c2E02d787e9DC71716786F8D19"],
    ["Optimism",        "0x85B704501f6AE718205C0636260768C4e72ac3e7"],
    ["Polygon",         "0x0B23efA164aB3eD08e9a39AC7aD930Ff4F5A5e81"],
    ["Scroll",          "0xcFAdDE24640e395F5A71456A825D0D7C3741F075"],
    ["Seievm",          "0x25f1c923fb7a5aefa5f0a2b419fc70f2368e66e5"],
    ["Solana",          "execXUrAsMnqMmTHj5m7N1YQgsDz3cwGLYCYyuDRciV"],
    ["Sonic",           "0x3Fdc36b4260Da38fBDba1125cCBD33DD0AC74812"],
    ["Sui",             "0xdb0fe8bb1e2b5be628adbea0636063325073e1070ee11e4281457dfd7f158235"],
    ["Unichain",        "0x764dD868eAdD27ce57BCB801E4ca4a193d231Aed"],
    ["Worldchain",      "0x8689b4E6226AdC8fa8FF80aCc3a60AcE31e8804B"],
    ["XRPLEVM",         "0x8345E90Dcd92f5Cf2FAb0C8E2A56A5bc2c30d896"],
  ]], [
  "Testnet", [
    ["Aptos",           "0x139717c339f08af674be77143507a905aa28cbc67a0e53e7095c07b630d73815"],
    ["ArbitrumSepolia", "0xBF161de6B819c8af8f2230Bcd99a9B3592f6F87b"],
    ["Avalanche",       "0x4661F0E629E4ba8D04Ee90080Aee079740B00381"],
    ["BaseSepolia",     "0x51B47D493CBA7aB97e3F8F163D6Ce07592CE4482"],
    ["Converge",        "0xAab9935349B9c08e0e970720F6D640d5B91C293E"],
    ["Fogo",            "execXUrAsMnqMmTHj5m7N1YQgsDz3cwGLYCYyuDRciV"],
    ["Monad",           "0xC04dE634982cAdF2A677310b73630B7Ac56A3f65"],
    // ["HyperCore",       "not-implemented"],
    ["OptimismSepolia", "0x5856651eB82aeb6979B4954317194d48e1891b3c"],
    ["Plume",           "0x8fc2FbA8F962fbE89a9B02f03557a011c335A455"],
    ["Seievm",          "0x25f1c923Fb7A5aEFA5F0A2b419fC70f2368e66e5"],
    ["Sepolia",         "0xD0fb39f5a3361F21457653cB70F9D0C9bD86B66B"],
    ["Solana",          "execXUrAsMnqMmTHj5m7N1YQgsDz3cwGLYCYyuDRciV"],
    ["Sui",             "0x4000cfe2955d8355b3d3cf186f854fea9f787a457257056926fde1ec977670eb"],
    ["XRPLEVM",         "0x4d9525D94D275dEB495b7C8840b154Ae04cfaC2A"],
    ["Mezo",            "0x0f9b8E144Cc5C5e7C0073829Afd30F26A50c5606"],
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;
