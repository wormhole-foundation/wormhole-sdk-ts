import {
  WormholeConfig,
  Context,
  ChainConfig,
  Contracts,
  Network,
} from '../types';

/**
 * Mainnet chain name to chain id mapping
 */
export const MAINNET_CHAINS = {
  solana: 1,
  ethereum: 2,
  bsc: 4,
  polygon: 5,
  avalanche: 6,
  fantom: 10,
  celo: 14,
  moonbeam: 16,
  sui: 21,
  aptos: 22,
  sei: 32,
} as const;

/**
 * mainnet chain name type
 */
export type MainnetChainName = keyof typeof MAINNET_CHAINS;
/**
 * mainnet chain id type
 */
export type MainnetChainId = (typeof MAINNET_CHAINS)[MainnetChainName];

/**
 * chain name to contracts mapping
 */
export type ChainContracts = {
  [chain in MainnetChainName]: Contracts;
};

const MAINNET: { [chain in MainnetChainName]: ChainConfig } = {
  ethereum: {
    key: 'ethereum',
    id: 2,
    context: Context.EVM,
    contracts: {
      core: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
      token_bridge: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
      nft_bridge: '0x6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 64,
    nativeTokenDecimals: 18,
  },
  solana: {
    key: 'solana',
    id: 1,
    context: Context.SOLANA,
    contracts: {
      core: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',
      token_bridge: 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb',
      nft_bridge: 'WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD',
    },
    finalityThreshold: 32,
    nativeTokenDecimals: 9,
  },
  polygon: {
    key: 'polygon',
    id: 5,
    context: Context.EVM,
    contracts: {
      core: '0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7',
      token_bridge: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
      nft_bridge: '0x90BBd86a6Fe93D3bc3ed6335935447E75fAb7fCf',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 512,
    nativeTokenDecimals: 18,
  },
  bsc: {
    key: 'bsc',
    id: 4,
    context: Context.EVM,
    contracts: {
      core: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
      token_bridge: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
      nft_bridge: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 15,
    nativeTokenDecimals: 18,
  },
  avalanche: {
    key: 'avalanche',
    id: 6,
    context: Context.EVM,
    contracts: {
      core: '0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c',
      token_bridge: '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052',
      nft_bridge: '0xf7B6737Ca9c4e08aE573F75A97B73D7a813f5De5',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  fantom: {
    key: 'fantom',
    id: 10,
    context: Context.EVM,
    contracts: {
      core: '0x126783A6Cb203a3E35344528B26ca3a0489a1485',
      token_bridge: '0x7C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2',
      nft_bridge: '0xA9c7119aBDa80d4a4E0C06C8F4d8cF5893234535',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  celo: {
    key: 'celo',
    id: 14,
    context: Context.EVM,
    contracts: {
      core: '0xa321448d90d4e5b0A732867c18eA198e75CAC48E',
      token_bridge: '0x796Dff6D74F3E27060B71255Fe517BFb23C93eed',
      nft_bridge: '0xA6A377d75ca5c9052c9a77ED1e865Cc25Bd97bf3',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  moonbeam: {
    key: 'moonbeam',
    id: 16,
    context: Context.EVM,
    contracts: {
      core: '0xC8e2b0cD52Cf01b0Ce87d389Daa3d414d4cE29f3',
      token_bridge: '0xb1731c586ca89a23809861c6103f0b96b3f57d92',
      nft_bridge: '0x453cfbe096c0f8d763e8c5f24b441097d577bde2',
      relayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
    },
    finalityThreshold: 1,
    nativeTokenDecimals: 18,
  },
  sui: {
    key: 'sui',
    id: 21,
    context: Context.SUI,
    contracts: {
      core: '0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c',
      token_bridge:
        '0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9',
      nft_bridge: undefined,
      relayer:
        '0x57f4e0ba41a7045e29d435bc66cc4175f381eb700e6ec16d4fdfe92e5a4dff9f',
      suiRelayerPackageId:
        '0x38035f4c1e1772d43a3535535ea5b29c1c3ab2c0026d4ad639969831bd1d174d',
      suiOriginalTokenBridgePackageId:
        '0x26efee2b51c911237888e5dc6702868abca3c7ac12c53f76ef8eba0697695e3d',
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
      nft_bridge:
        '0x1bdffae984043833ed7fe223f7af7a3f8902d04129b14f801823e64827da7130',
    },
    finalityThreshold: 0,
    nativeTokenDecimals: 8,
  },
  sei: {
    key: 'sei',
    id: 32,
    context: Context.SEI,
    contracts: {
      core: 'sei1gjrrme22cyha4ht2xapn3f08zzw6z3d4uxx6fyy9zd5dyr3yxgzqqncdqn',
      token_bridge:
        'sei1smzlm9t79kur392nu9egl8p8je9j92q4gzguewj56a05kyxxra0qy0nuf3',
      nft_bridge: undefined,
      seiTokenTranslator: '',
    },
    finalityThreshold: 0,
    nativeTokenDecimals: 6,
  },
};

/**
 * default mainnet chain config
 */
const MAINNET_CONFIG: WormholeConfig = {
  network: Network.MAINNET,
  api: 'https://api.wormscan.io',
  rpcs: {
    ethereum: 'https://rpc.ankr.com/eth',
    solana: 'https://api.mainnet-beta.solana.com',
    polygon: 'https://rpc.ankr.com/polygon',
    bsc: 'https://bscrpc.com',
    avalanche: 'https://rpc.ankr.com/avalanche',
    fantom: 'https://rpc.ankr.com/fantom',
    celo: 'https://rpc.ankr.com/celo',
    moonbeam: 'https://rpc.ankr.com/moonbeam',
    sui: 'https://rpc.mainnet.sui.io',
    aptos: 'https://fullnode.mainnet.aptoslabs.com/v1',
    sei: '', // TODO: fill in
  },
  rest: {
    sei: '',
  },
  chains: MAINNET,
};

export default MAINNET_CONFIG;
