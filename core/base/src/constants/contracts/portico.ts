import type { MapLevels } from './../../utils/index.js';
import type { Chain } from '../chains.js';
import type { Network } from '../networks.js';

export type PorticoContracts = {
  portico: string;
  uniswapQuoterV2: string;
};

// prettier-ignore
export const porticoContracts = [
  [
    "Mainnet",
    [
      ["Ethereum", {
        portico: '0x48b6101128C0ed1E208b7C910e60542A2ee6f476',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      }],
      ["Polygon", {
        portico: '0x227bABe533fa9a1085f5261210E0B7137E44437B',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      }],
      ["Bsc",  {
        portico: '0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85',
        uniswapQuoterV2: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
      }],
      ["Avalanche", {
        portico: '0xE565E118e75304dD3cF83dff409c90034b7EA18a',
        uniswapQuoterV2: '0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F',
      }],
      ["Arbitrum", {
        portico: '0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      }],
      ["Optimism", {
        portico: '0x9ae506cDDd27DEe1275fd1fe6627E5dc65257061',
        uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      }],
      ["Base", {
        portico: '0x610d4DFAC3EC32e0be98D18DDb280DACD76A1889',
        uniswapQuoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      }],
    ]
]] as const satisfies MapLevels<[Network, Chain, PorticoContracts]>
