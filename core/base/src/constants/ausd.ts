import type { MapLevel } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";

// prettier-ignore
const ausdContracts = [[
  "Mainnet", [
      // AUSD token addresses
      ["Arbitrum", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Avalanche", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Base", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Bsc", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Ethereum", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Mantle", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Monad", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Plume", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Polygon", "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a"],
      ["Solana", "AUSD1jCcCyPLybk1YnvPWsHQSrZ46dxwoMniN4N2UEB9"],
      ["Sui", "0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD"],
  ]],
  ["Testnet", [
      ["ArbitrumSepolia", "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC"],
      ["BaseSepolia", "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC"],
      ["OptimismSepolia", "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC"],
      ["Sepolia", "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC"],
  ]],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;

export const ausdContract = constMap(ausdContracts);
