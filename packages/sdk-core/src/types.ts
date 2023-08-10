import { BigNumber } from 'ethers';
import { ParsedVaa, SignedVaa } from './utils/vaa/index.js';
import { MainnetChainId, MainnetChainName } from './config/MAINNET.js';
import { TestnetChainId, TestnetChainName } from './config/TESTNET.js';
import { RelayerAbstract } from './abstracts/relayer.js';
import { ContractsAbstract } from './abstracts/contracts.js';

export enum Network {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
}
export const NATIVE = 'native';
// TODO: conditionally set these types
export type ChainName = MainnetChainName | TestnetChainName;
export type ChainId = MainnetChainId | TestnetChainId;
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

export type AnyContext = RelayerAbstract<any>;
export type AnyContracts = ContractsAbstract;

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

export type SendResult = Awaited<ReturnType<AnyContext['startTransfer']>>;
export type RedeemResult = Awaited<ReturnType<AnyContext['completeTransfer']>>;

export type VaaSourceTransaction = any;
export interface VaaInfo<T extends VaaSourceTransaction = any> {
  transaction: T;
  rawVaa: SignedVaa;
  vaa: ParsedVaa;
}
