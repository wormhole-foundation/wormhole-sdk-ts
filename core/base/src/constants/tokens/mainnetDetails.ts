import { MapLevel, constMap } from "../../utils";
import { TokenSymbol, TokenExtraDetails } from "./types";

const mainnetTokens = [
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
    "BUSD",
    {
      key: "BUSD",
      symbol: "BUSD",
      coinGeckoId: "binance-usd",
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
    "WETHpolygon",
    {
      key: "WETHpolygon",
      symbol: "WETH",
      displayName: "WETH (Polygon)",
      coinGeckoId: "ethereum",
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
    "USDCbnb",
    {
      key: "USDCbnb",
      symbol: "USDC",
      coinGeckoId: "usd-coin",
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
    "WETHavax",
    {
      key: "WETHavax",
      symbol: "WETH",
      displayName: "WETH (Avalanche)",
      coinGeckoId: "ethereum",
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
    "WETHbsc",
    {
      key: "WETHbsc",
      symbol: "WETH",
      displayName: "WETH (BSC)",
      coinGeckoId: "ethereum",
      nativeChain: "Bsc",
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
    "wstETHbase",
    {
      key: "wstETHbase",
      symbol: "wstETH",
      displayName: "wstETH (Base)",
      coinGeckoId: "wrapped-steth",
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
    "wstETHarbitrum",
    {
      key: "wstETHarbitrum",
      symbol: "wstETH",
      displayName: "wstETH (Arbitrum)",
      coinGeckoId: "wrapped-steth",
      nativeChain: "Arbitrum",
    },
  ],
  [
    "wstETHoptimism",
    {
      key: "wstETHoptimism",
      symbol: "wstETH",
      displayName: "wstETH (Optimism)",
      coinGeckoId: "wrapped-steth",
      nativeChain: "Optimism",
    },
  ],
  [
    "wstETHpolygon",
    {
      key: "wstETHpolygon",
      symbol: "wstETH",
      displayName: "wstETH (Polygon)",
      coinGeckoId: "wrapped-steth",
      nativeChain: "Polygon",
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
    "PYTH",
    {
      key: "PYTH",
      symbol: "PYTH",
      coinGeckoId: "pyth-network",
      nativeChain: "Solana",
    },
  ],
] as const satisfies MapLevel<TokenSymbol, TokenExtraDetails>;

export const mainnetTokenDetails = constMap(mainnetTokens);
