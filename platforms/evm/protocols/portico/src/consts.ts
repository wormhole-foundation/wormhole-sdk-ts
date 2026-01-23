import { Wormhole } from '@wormhole-foundation/sdk-connect';

export const FEE_TIER = 100;

export const supportedTokens = {
  ETH: [
    Wormhole.tokenId('Arbitrum', 'native'),
    Wormhole.tokenId('Base', 'native'),
    Wormhole.tokenId('Ethereum', 'native'),
    Wormhole.tokenId('Optimism', 'native'),
  ],
  WETH: [
    Wormhole.tokenId('Arbitrum', '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'),
    Wormhole.tokenId('Avalanche', '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'),
    Wormhole.tokenId('Base', '0x4200000000000000000000000000000000000006'),
    Wormhole.tokenId('Bsc', '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'),
    Wormhole.tokenId('Ethereum', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
    Wormhole.tokenId('Optimism', '0x4200000000000000000000000000000000000006'),
    Wormhole.tokenId('Polygon', '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'),
  ],
  wstETH: [
    Wormhole.tokenId('Arbitrum', '0x5979D7b546E38E414F7E9822514be443A4800529'),
    Wormhole.tokenId('Base', '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452'),
    Wormhole.tokenId('Ethereum', '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'),
    Wormhole.tokenId('Optimism', '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb'),
    Wormhole.tokenId('Polygon', '0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD'),
  ],
  USDT: [
    Wormhole.tokenId('Arbitrum', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'),
    Wormhole.tokenId('Avalanche', '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'),
    Wormhole.tokenId('Base', '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'),
    Wormhole.tokenId('Bsc', '0x55d398326f99059fF775485246999027B3197955'),
    Wormhole.tokenId('Ethereum', '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
    Wormhole.tokenId('Optimism', '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'),
    Wormhole.tokenId('Polygon', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
    Wormhole.tokenId('Celo', '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'),
  ],
} as const;
