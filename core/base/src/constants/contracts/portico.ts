import type { MapLevels } from "./../../utils/index.js";
import type { Chain } from "../chains.js";
import type { Network } from "../networks.js";

export type PorticoContracts = {
  porticoUniswap: string;
  uniswapQuoterV2: string;
  porticoPancakeSwap?: string;
  pancakeSwapQuoterV2?: string;
};

// prettier-ignore
export const porticoContracts = [
  [
    "Mainnet",
    [
      ["Ethereum", {
        porticoUniswap: '0x48b6101128C0ed1E208b7C910e60542A2ee6f476',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        porticoPancakeSwap: '0x4db1683d60e0a933A9A477a19FA32F472bB9d06e',
        pancakeSwapQuoterV2: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      }],
      ["Polygon", {
        porticoUniswap: '0x227bABe533fa9a1085f5261210E0B7137E44437B',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        porticoPancakeSwap: undefined,
        pancakeSwapQuoterV2: undefined,
      }],
      ["Bsc",  {
        porticoUniswap: '0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85',
        uniswapQuoterV2: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
        porticoPancakeSwap: '0xF352DC165783538A26e38A536e76DceF227d90F2',
        pancakeSwapQuoterV2: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      }],
      ["Avalanche", {
        porticoUniswap: '0xE565E118e75304dD3cF83dff409c90034b7EA18a',
        uniswapQuoterV2: '0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F',
        porticoPancakeSwap: undefined,
        pancakeSwapQuoterV2: undefined,
      }],
      ["Arbitrum", {
        porticoUniswap: '0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        porticoPancakeSwap: '0xE70946692E2e56ae47BfAe2d93d31bd60952B090',
        pancakeSwapQuoterV2: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      }],
      ["Optimism", {
        porticoUniswap: '0x9ae506cDDd27DEe1275fd1fe6627E5dc65257061',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        porticoPancakeSwap: undefined,
        pancakeSwapQuoterV2: undefined,
      }],
      ["Base", {
        porticoUniswap: '0x610d4DFAC3EC32e0be98D18DDb280DACD76A1889',
        uniswapQuoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        porticoPancakeSwap: '0x4568aa1eA0ED54db666c58B4526B3FC9BD9be9bf',
        pancakeSwapQuoterV2: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      }],
      ["Celo", {
        porticoUniswap: '0xE565E118e75304dD3cF83dff409c90034b7EA18a',
        uniswapQuoterV2: '0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8',
        porticoPancakeSwap: undefined,
        pancakeSwapQuoterV2: undefined,
      }]
    ]
]] as const satisfies MapLevels<[Network, Chain, PorticoContracts]>
