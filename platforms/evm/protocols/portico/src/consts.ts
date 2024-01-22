import { Chain } from '@wormhole-foundation/connect-sdk';

// https://github.com/wormhole-foundation/uniswap-liquidity-layer/blob/17ec9650e44ff52a601a9f84d9606a25174205ef/src/services/RolodexService.ts#L220

export const FEE_TIER = 100;
export const SWAP_ERROR =
  'This transaction will not succeed due to price movement.';
export const swapErrors = [
  'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT',
  'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT',
  'Too little received',
  'Too much requested',
  'STF',
];

export type PorticoContractAddresses = {
  portico: string;
  uniswapQuoterV2: string;
};
export const CONTRACTS: {
  [key in Chain]?: PorticoContractAddresses;
} = {
  Ethereum: {
    portico: '0x48b6101128C0ed1E208b7C910e60542A2ee6f476',
    uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  },
  Polygon: {
    portico: '0x227bABe533fa9a1085f5261210E0B7137E44437B',
    uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  },
  Bsc: {
    portico: '0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85',
    uniswapQuoterV2: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
  },
  Avalanche: {
    portico: '0xE565E118e75304dD3cF83dff409c90034b7EA18a',
    uniswapQuoterV2: '0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F',
  },
  Arbitrum: {
    portico: '0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130',
    uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  },
  Optimism: {
    portico: '0x9ae506cDDd27DEe1275fd1fe6627E5dc65257061',
    uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  },
  Base: {
    portico: '0x610d4DFAC3EC32e0be98D18DDb280DACD76A1889',
    uniswapQuoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  },
};

// const canonAssetTable = {
//   Ethereum: {
//     '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ETH',
//     '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'WSTETH',
//   },
//   Arbitrum: {
//     '0xd8369c2eda18dd6518eabb1f85bd60606deb39ec': 'ETH',
//     '0xf2717122Dfdbe988ae811E7eFB157aAa07Ff9D0F': 'WSTETH',
//   },
//   Polygon: {
//     '0x11CD37bb86F65419713f30673A480EA33c826872': 'ETH',
//     '0xe082a7fc696de18172ad08d956569ee80bc37f06': 'WSTETH',
//   },
//   Base: {
//     '0x71b35ecb35104773537f849fbc353f81303a5860': 'ETH',
//     '0xEd4e2FD35161c3c0e33cA187fce64C70d44Ce32b': 'WSTETH',
//   },
//   Optimism: {
//     '0xb47bC3ed6D70F04fe759b2529c9bc7377889678f': 'ETH',
//     '0x855CFcEEe998c8ca34F9c914F584AbF72dC88B87': 'WSTETH',
//   },
//   Bsc: {
//     '0x4DB5a66E937A9F4473fA95b1cAF1d1E1D62E29EA': 'ETH',
//     '0xad80e1a9b5824234afa9de1f3bbdb8a994796169': 'WSTETH',
//   },
//   Avalanche: {
//     '0x8b82A291F83ca07Af22120ABa21632088fC92931': 'ETH',
//   },
// };
//
// const nativeAssetTable = {
//   Ethereum: {
//     '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ETH',
//     '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0': 'WSTETH',
//   },
//   Arbitrum: {
//     '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'ETH',
//     '0x5979D7b546E38E414F7E9822514be443A4800529': 'WSTETH',
//   },
//   Polygon: {
//     '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': 'ETH',
//     '0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD': 'WSTETH',
//   },
//   Base: {
//     '0x4200000000000000000000000000000000000006': 'ETH',
//     '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452': 'WSTETH',
//   },
//   Optimism: {
//     '0x4200000000000000000000000000000000000006': 'ETH',
//     '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb': 'WSTETH',
//   },
//   Bsc: {
//     '0x2170Ed0880ac9A755fd29B2688956BD959F933F8': 'ETH',
//     '0x2Bbbdf97295F73175b12CC087cF446765931e1C3': 'WSTETH',
//   },
//   Avalanche: {
//     '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab': 'ETH',
//   },
// };

export const getContracts = (chain: Chain): PorticoContractAddresses => {
  if (!(chain in CONTRACTS))
    throw new Error(`Contracts not found for ${chain}`);
  return CONTRACTS[chain]!;
};
