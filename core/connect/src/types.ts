import { BigNumber } from 'ethers';
import {
  Network,
  ChainId,
  Chain as ChainName,
  MAINNET,
  TESTNET,
} from '@wormhole-foundation/sdk-base';

export type AnyContext = any;
export type RedeemResult = any;
export type SendResult = any;

export const NATIVE = 'native';

// TODO: wat
export enum Context {
  EVM = 'EVM',
  TERRA = 'Terra',
  INJECTIVE = 'Injective',
  XPLA = 'XPLA',
  SOLANA = 'Solana',
  ALGORAND = 'Algorand',
  NEAR = 'Near',
  APTOS = 'Aptos',
  SUI = 'Sui',
  SEI = 'Sei',
  OTHER = 'OTHER',
}

export type ChainResourceMap = {
  [chain in ChainName]?: string;
};

export type ContextConfig = {
  [C in Context]?: any;
};

export type Contracts = {
  core?: string;
  token_bridge?: string;
  nft_bridge?: string;
  relayer?: string;
  suiOriginalTokenBridgePackageId?: string;
  suiRelayerPackageId?: string;
  seiTokenTranslator?: string;
};

export type ChainConfig = {
  key: ChainName;
  id: ChainId;
  context: Context;
  contracts: Contracts;
  finalityThreshold: number;
  nativeTokenDecimals: number;
};

export type WormholeConfig = {
  network: Network;
  api: string;
  rpcs: ChainResourceMap;
  rest: ChainResourceMap;
  chains: {
    [chain in ChainName]?: ChainConfig;
  };
};

export type Address = string;

export type TokenId = {
  chain: ChainName;
  address: string;
};

export interface ParsedMessage {
  sendTx: string;
  sender: string;
  amount: BigNumber;
  payloadID: number;
  recipient: string;
  toChain: ChainName;
  fromChain: ChainName;
  tokenAddress: string;
  tokenChain: ChainName;
  tokenId: TokenId;
  sequence: BigNumber;
  emitterAddress: string;
  block: number;
  gasFee?: BigNumber;
  payload?: string;
}

export interface ParsedRelayerPayload {
  relayerPayloadId: number;
  to: string;
  relayerFee: BigNumber;
  toNativeTokenAmount: BigNumber;
}

export type ParsedRelayerMessage = ParsedMessage & ParsedRelayerPayload;

export type AnyMessage = ParsedMessage | ParsedRelayerMessage;

export type MessageIdentifier = {
  emitterChain: ChainId;
  emitterAddress: string;
  sequence: string;
};

export type TokenDetails = {
  symbol: string;
  decimals: number;
};

export interface WormholeWrappedInfo {
  isWrapped: boolean;
  chainId: ChainId;
  assetAddress: Uint8Array;
}

/**
 * default mainnet chain config
 */
export const MAINNET_CONFIG: WormholeConfig = {
  network: MAINNET,
  api: 'https://api.wormscan.io',
  rpcs: {
    Ethereum: 'https://rpc.ankr.com/eth',
    Solana: 'https://api.mainnet-beta.solana.com',
    Polygon: 'https://rpc.ankr.com/polygon',
    Bsc: 'https://bscrpc.com',
    Avalanche: 'https://rpc.ankr.com/avalanche',
    Fantom: 'https://rpc.ankr.com/fantom',
    Celo: 'https://rpc.ankr.com/celo',
    Moonbeam: 'https://rpc.ankr.com/moonbeam',
    Sui: 'https://rpc.mainnet.sui.io',
    Aptos: 'https://fullnode.mainnet.aptoslabs.com/v1',
    Sei: '', // TODO: fill in
  },
  rest: {
    Sei: '',
  },
  chains: {},
};

/**
 * default testnet chain config
 */
export const TESTNET_CONFIG: WormholeConfig = {
  network: TESTNET,
  api: 'https://api.testnet.wormscan.io',
  rpcs: {
    Ethereum: 'https://rpc.ankr.com/eth_goerli',
    Polygon: 'https://polygon-mumbai.blockpi.network/v1/rpc/public',
    Bsc: 'https://data-seed-prebsc-1-s3.binance.org:8545',
    Avalanche: 'https://api.avax-test.network/ext/bc/C/rpc',
    Fantom: 'https://rpc.ankr.com/fantom_testnet',
    Celo: 'https://alfajores-forno.celo-testnet.org',
    Solana: 'https://api.devnet.solana.com',
    Moonbeam: 'https://rpc.api.moonbase.moonbeam.network',
    Sui: 'https://fullnode.testnet.sui.io',
    Aptos: 'https://fullnode.testnet.aptoslabs.com/v1',
    Sei: 'https://rpc.atlantic-2.seinetwork.io',
  },
  rest: {
    Sei: 'https://rest.atlantic-2.seinetwork.io',
  },
  chains: {},
};
