import { MapLevel, constMap } from "../../utils";
import { TokenSymbol, TokenExtraDetails } from "./types";

const testnetTokens = [
  [
    "ETH",
    {
      key: "ETH",
      symbol: "ETH",
      coinGeckoId: "ethereum",
      nativeChain: "Ethereum",
    },
  ],
  [
    "WETH",
    {
      key: "WETH",
      symbol: "WETH",
      coinGeckoId: "ethereum",
      nativeChain: "Ethereum",
    },
  ],
  [
    "USDCeth",
    {
      key: "USDCeth",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Ethereum",
    },
  ],
  [
    "WBTC",
    {
      key: "WBTC",
      symbol: "WBTC",
      coinGeckoId: "wrapped-bitcoin",
      nativeChain: "Ethereum",
    },
  ],
  [
    "USDT",
    {
      key: "USDT",
      symbol: "USDT",
      coinGeckoId: "tether",
      nativeChain: "Ethereum",
    },
  ],
  [
    "DAI",
    {
      key: "DAI",
      symbol: "DAI",
      coinGeckoId: "dai",
      nativeChain: "Ethereum",
    },
  ],
  [
    "MATIC",
    {
      key: "MATIC",
      symbol: "MATIC",
      coinGeckoId: "matic-network",
      nativeChain: "Polygon",
    },
  ],
  [
    "WMATIC",
    {
      key: "WMATIC",
      symbol: "WMATIC",
      coinGeckoId: "matic-network",
      nativeChain: "Polygon",
    },
  ],
  [
    "USDCpolygon",
    {
      key: "USDCpolygon",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Polygon",
    },
  ],
  [
    "BNB",
    {
      key: "BNB",
      symbol: "BNB",
      coinGeckoId: "binancecoin",
      nativeChain: "Bsc",
    },
  ],
  [
    "WBNB",
    {
      key: "WBNB",
      symbol: "WBNB",
      coinGeckoId: "binancecoin",
      nativeChain: "Bsc",
    },
  ],
  [
    "AVAX",
    {
      key: "AVAX",
      symbol: "AVAX",
      coinGeckoId: "avalanche-2",
      nativeChain: "Avalanche",
    },
  ],
  [
    "WAVAX",
    {
      key: "WAVAX",
      symbol: "WAVAX",
      coinGeckoId: "avalanche-2",
      nativeChain: "Avalanche",
    },
  ],
  [
    "USDCavax",
    {
      key: "USDCavax",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Avalanche",
    },
  ],
  [
    "FTM",
    {
      key: "FTM",
      symbol: "FTM",
      coinGeckoId: "fantom",
      nativeChain: "Fantom",
    },
  ],
  [
    "WFTM",
    {
      key: "WFTM",
      symbol: "WFTM",
      coinGeckoId: "fantom",
      nativeChain: "Fantom",
    },
  ],
  [
    "CELO",
    {
      key: "CELO",
      symbol: "CELO",
      coinGeckoId: "celo",
      nativeChain: "Celo",
    },
  ],
  [
    "GLMR",
    {
      key: "GLMR",
      symbol: "GLMR",
      coinGeckoId: "moonbeam",
      nativeChain: "Moonbeam",
    },
  ],
  [
    "WGLMR",
    {
      key: "WGLMR",
      symbol: "WGLMR",
      coinGeckoId: "moonbeam",
      nativeChain: "Moonbeam",
    },
  ],
  [
    "SOL",
    {
      key: "SOL",
      symbol: "SOL",
      coinGeckoId: "solana",
      nativeChain: "Solana",
    },
  ],
  [
    "WSOL",
    {
      key: "WSOL",
      symbol: "WSOL",
      coinGeckoId: "solana",
      nativeChain: "Solana",
    },
  ],
  [
    "USDCsol",
    {
      key: "USDCsol",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Solana",
    },
  ],
  [
    "SUI",
    {
      key: "SUI",
      symbol: "SUI",
      coinGeckoId: "sui",
      nativeChain: "Sui",
    },
  ],
  [
    "APT",
    {
      key: "APT",
      symbol: "APT",
      coinGeckoId: "aptos",
      nativeChain: "Aptos",
    },
  ],
  [
    "ETHarbitrum",
    {
      key: "ETHarbitrum",
      symbol: "ETH",
      displayName: "ETH (Arbitrum)",
      coinGeckoId: "ethereum",
      nativeChain: "Arbitrum",
    },
  ],
  [
    "WETHarbitrum",
    {
      key: "WETHarbitrum",
      symbol: "WETH",
      displayName: "WETH (Arbitrum)",
      coinGeckoId: "ethereum",
      nativeChain: "Arbitrum",
    },
  ],
  [
    "USDCarbitrum",
    {
      key: "USDCarbitrum",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Arbitrum",
    },
  ],
  [
    "ETHoptimism",
    {
      key: "ETHoptimism",
      symbol: "ETH",
      displayName: "ETH (Optimism)",
      coinGeckoId: "ethereum",
      nativeChain: "Optimism",
    },
  ],
  [
    "WETHoptimism",
    {
      key: "WETHoptimism",
      symbol: "WETH",
      displayName: "WETH (Optimism)",
      coinGeckoId: "ethereum",
      nativeChain: "Optimism",
    },
  ],
  [
    "USDCoptimism",
    {
      key: "USDCoptimism",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Optimism",
    },
  ],
  [
    "ETHbase",
    {
      key: "ETHbase",
      symbol: "ETH",
      displayName: "ETH (Base)",
      coinGeckoId: "ethereum",
      nativeChain: "Base",
    },
  ],
  [
    "WETHbase",
    {
      key: "WETHbase",
      symbol: "WETH",
      displayName: "WETH (Base)",
      coinGeckoId: "ethereum",
      nativeChain: "Base",
    },
  ],
  [
    "USDCbase",
    {
      key: "USDCbase",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
      nativeChain: "Base",
    },
  ],
  [
    "OSMO",
    {
      key: "OSMO",
      symbol: "OSMO",
      coinGeckoId: "osmosis",
      nativeChain: "Osmosis",
    },
  ],
  [
    "tBTC",
    {
      key: "tBTC",
      symbol: "tBTC",
      coinGeckoId: "tbtc",
      nativeChain: "Ethereum",
    },
  ],
  [
    "tBTCpolygon",
    {
      key: "tBTCpolygon",
      symbol: "tBTC",
      coinGeckoId: "tbtc",
      nativeChain: "Polygon",
    },
  ],
  [
    "tBTCoptimism",
    {
      key: "tBTCoptimism",
      symbol: "tBTC",
      coinGeckoId: "tbtc",
      nativeChain: "Optimism",
    },
  ],
  [
    "tBTCarbitrum",
    {
      key: "tBTCarbitrum",
      symbol: "tBTC",
      coinGeckoId: "tbtc",
      nativeChain: "Arbitrum",
    },
  ],
  [
    "tBTCbase",
    {
      key: "tBTCbase",
      symbol: "tBTC",
      coinGeckoId: "tbtc",
      nativeChain: "Base",
    },
  ],
  [
    "tBTCsol",
    {
      key: "tBTCsol",
      symbol: "tBTC",
      coinGeckoId: "tbtc",
      nativeChain: "Solana",
    },
  ],
  [
    "wstETH",
    {
      key: "wstETH",
      symbol: "wstETH",
      coinGeckoId: "wrapped-steth",
      nativeChain: "Ethereum",
    },
  ],
  [
    "SEI",
    {
      key: "SEI",
      symbol: "SEI",
      coinGeckoId: "sei-network",
      nativeChain: "Sei",
    },
  ],
  [
    "ATOM",
    {
      key: "ATOM",
      symbol: "ATOM",
      coinGeckoId: "cosmos-hub",
      nativeChain: "Cosmoshub",
    },
  ],
  [
    "EVMOS",
    {
      key: "EVMOS",
      symbol: "EVMOS",
      coinGeckoId: "evmos",
      nativeChain: "Evmos",
    },
  ],
  [
    "KUJI",
    {
      key: "KUJI",
      symbol: "KUJI",
      coinGeckoId: "kujira",
      nativeChain: "Kujira",
    },
  ],
  [
    "KLAY",
    {
      key: "KLAY",
      symbol: "KLAY",
      coinGeckoId: "klay-token",
      nativeChain: "Klaytn",
    },
  ],
  [
    "WKLAY",
    {
      key: "WKLAY",
      symbol: "WKLAY",
      displayName: "wKLAY",
      coinGeckoId: "wrapped-klay",
      nativeChain: "Klaytn",
    },
  ],
  [
    "ETHsepolia",
    {
      key: "ETHsepolia",
      symbol: "ETH",
      displayName: "ETH (Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "Sepolia",
    },
  ],
  [
    "WETHsepolia",
    {
      key: "WETHsepolia",
      symbol: "WETH",
      displayName: "WETH (Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "Sepolia",
    },
  ],
  [
    "ETHarbitrum_sepolia",
    {
      key: "ETHarbitrum_sepolia",
      symbol: "ETH",
      displayName: "ETH (Arbitrum Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "ArbitrumSepolia",
    },
  ],
  [
    "WETHarbitrum_sepolia",
    {
      key: "WETHarbitrum_sepolia",
      symbol: "WETH",
      displayName: "WETH (Arbitrum Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "ArbitrumSepolia",
    },
  ],
  [
    "ETHbase_sepolia",
    {
      key: "ETHbase_sepolia",
      symbol: "ETH",
      displayName: "ETH (Base Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "BaseSepolia",
    },
  ],
  [
    "WETHbase_sepolia",
    {
      key: "WETHbase_sepolia",
      symbol: "WETH",
      displayName: "WETH (Base Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "BaseSepolia",
    },
  ],
  [
    "ETHoptimism_sepolia",
    {
      key: "ETHoptimism_sepolia",
      symbol: "ETH",
      displayName: "ETH (Optimism Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "OptimismSepolia",
    },
  ],
  [
    "WETHoptimism_sepolia",
    {
      key: "WETHoptimism_sepolia",
      symbol: "WETH",
      displayName: "WETH (Optimism Sepolia)",
      coinGeckoId: "ethereum",
      nativeChain: "OptimismSepolia",
    },
  ],
] as const satisfies MapLevel<TokenSymbol, TokenExtraDetails>;

export const testnetTokenDetails = constMap(testnetTokens);
