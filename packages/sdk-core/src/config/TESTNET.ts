import {
  WormholeConfig,
  Context,
  ChainConfig,
  Contracts,
  Network,
} from '../types.js';

/**
 * Testnet chain name to chain id mapping
 */
export const TESTNET_CHAINS = {
  solana: 1,
  goerli: 2,
  bsc: 4,
  mumbai: 5,
  fuji: 6,
  fantom: 10,
  alfajores: 14,
  moonbasealpha: 16,
  sui: 21,
  aptos: 22,
  sei: 32,
} as const;

/**
 * testnet chain name type
 */
export type TestnetChainName = keyof typeof TESTNET_CHAINS;
/**
 * testnet chain id type
 */
export type TestnetChainId = (typeof TESTNET_CHAINS)[TestnetChainName];
/**
 * chain name to contracts mapping
 */
export type ChainContracts = {
  [chain in TestnetChainName]: Contracts;
};

const TESTNET: { [chain in TestnetChainName]: ChainConfig } = {
  goerli: {
    key: 'goerli',
    id: 2,
    context: Context.EVM,
    contracts: {
      core: '0x706abc4E45D419950511e474C7B9Ed348A4a716c',
      token_bridge: '0xF890982f9310df57d00f659cf4fd87e65adEd8d7',
      nft_bridge: '0xD8E4C2DbDd2e2bd8F1336EA691dBFF6952B1a6eB',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 64,
    nativeTokenDecimals: 18,
  },
  solana: {
    key: 'solana',
    id: 1,
    context: Context.SOLANA,
    contracts: {
      core: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
      token_bridge: 'DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe',
      nft_bridge: '2rHhojZ7hpu1zA91nvZmT8TqWWvMcKmmNBCr2mKTtMq4',
    },
    finalityThreshold: 32,
    nativeTokenDecimals: 9,
  },
  mumbai: {
    key: 'mumbai',
    id: 5,
    context: Context.EVM,
    contracts: {
      core: '0x0CBE91CF822c73C2315FB05100C2F714765d5c20',
      token_bridge: '0x377D55a7928c046E18eEbb61977e714d2a76472a',
      nft_bridge: '0x51a02d0dcb5e52F5b92bdAA38FA013C91c7309A9',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 64,
    nativeTokenDecimals: 18,
  },
  bsc: {
    key: 'bsc',
    id: 4,
    context: Context.EVM,
    contracts: {
      core: '0x68605AD7b15c732a30b1BbC62BE8F2A509D74b4D',
      token_bridge: '0x9dcF9D205C9De35334D646BeE44b2D2859712A09',
      nft_bridge: '0xcD16E5613EF35599dc82B24Cb45B5A93D779f1EE',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 15,
    nativeTokenDecimals: 18,
  },
  fuji: {
    key: 'fuji',
    id: 6,
    context: Context.EVM,
    contracts: {
      core: '0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C',
      token_bridge: '0x61E44E506Ca5659E6c0bba9b678586fA2d729756',
      nft_bridge: '0xD601BAf2EEE3C028344471684F6b27E789D9075D',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  fantom: {
    key: 'fantom',
    id: 10,
    context: Context.EVM,
    contracts: {
      core: '0x1BB3B4119b7BA9dfad76B0545fb3F531383c3bB7',
      token_bridge: '0x599CEa2204B4FaECd584Ab1F2b6aCA137a0afbE8',
      nft_bridge: '0x63eD9318628D26BdCB15df58B53BB27231D1B227',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  alfajores: {
    key: 'alfajores',
    id: 14,
    context: Context.EVM,
    contracts: {
      core: '0x88505117CA88e7dd2eC6EA1E13f0948db2D50D56',
      token_bridge: '0x05ca6037eC51F8b712eD2E6Fa72219FEaE74E153',
      nft_bridge: '0xaCD8190F647a31E56A656748bC30F69259f245Db',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  moonbasealpha: {
    key: 'moonbasealpha',
    id: 16,
    context: Context.EVM,
    contracts: {
      core: '0xa5B7D85a8f27dd7907dc8FdC21FA5657D5E2F901',
      token_bridge: '0xbc976D4b9D57E57c3cA52e1Fd136C45FF7955A96',
      nft_bridge: '0x98A0F4B96972b32Fcb3BD03cAeB66A44a6aB9Edb',
      relayer: '0x9563a59c15842a6f322b10f69d1dd88b41f2e97b',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  sui: {
    key: 'sui',
    id: 21,
    context: Context.SUI,
    contracts: {
      core: '0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790',
      token_bridge:
        '0x6fb10cdb7aa299e9a4308752dadecb049ff55a892de92992a1edbd7912b3d6da',
      nft_bridge: undefined,
      relayer:
        '0xb30040e5120f8cb853b691cb6d45981ae884b1d68521a9dc7c3ae881c0031923', // suiRelayerObjectId
      suiRelayerPackageId:
        '0x12eb7e64389d8f0e052d8bda10f46aab1dcb6efeec59decf1897708450171050',
      suiOriginalTokenBridgePackageId:
        '0x562760fc51d90d4ae1835bac3e91e0e6987d3497b06f066941d3e51f6e8d76d0',
    },
    finalityThreshold: 0,
    nativeTokenDecimals: 9,
  },
  aptos: {
    key: 'aptos',
    id: 22,
    context: Context.APTOS,
    contracts: {
      core: '0x5bc11445584a763c1fa7ed39081f1b920954da14e04b32440cba863d03e19625',
      token_bridge:
        '0x576410486a2da45eee6c949c995670112ddf2fbeedab20350d506328eefc9d4f',
      nft_bridge: undefined,
    },
    finalityThreshold: 0,
    nativeTokenDecimals: 8,
  },
  sei: {
    key: 'sei',
    id: 32,
    context: Context.SEI,
    contracts: {
      core: 'sei1nna9mzp274djrgzhzkac2gvm3j27l402s4xzr08chq57pjsupqnqaj0d5s',
      token_bridge:
        'sei1jv5xw094mclanxt5emammy875qelf3v62u4tl4lp5nhte3w3s9ts9w9az2',
      nft_bridge: undefined,
      seiTokenTranslator:
        'sei1dkdwdvknx0qav5cp5kw68mkn3r99m3svkyjfvkztwh97dv2lm0ksj6xrak',
    },
    finalityThreshold: 0,
    nativeTokenDecimals: 6,
  },
};

/**
 * default testnet chain config
 */
const TESTNET_CONFIG: WormholeConfig = {
  network: Network.TESTNET,
  api: 'https://api.testnet.wormscan.io',
  rpcs: {
    goerli: 'https://rpc.ankr.com/eth_goerli',
    mumbai: 'https://polygon-mumbai.blockpi.network/v1/rpc/public',
    bsc: 'https://data-seed-prebsc-1-s3.binance.org:8545',
    fuji: 'https://api.avax-test.network/ext/bc/C/rpc',
    fantom: 'https://rpc.ankr.com/fantom_testnet',
    alfajores: 'https://alfajores-forno.celo-testnet.org',
    solana: 'https://api.devnet.solana.com',
    moonbasealpha: 'https://rpc.api.moonbase.moonbeam.network',
    sui: 'https://fullnode.testnet.sui.io',
    aptos: 'https://fullnode.testnet.aptoslabs.com/v1',
    sei: 'https://rpc.atlantic-2.seinetwork.io',
  },
  rest: {
    sei: 'https://rest.atlantic-2.seinetwork.io',
  },
  chains: TESTNET,
};

export default TESTNET_CONFIG;
