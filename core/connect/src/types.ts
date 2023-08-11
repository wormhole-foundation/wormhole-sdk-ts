import { BigNumber } from 'ethers';
import {
  Platform,
  Network,
  ChainId,
  ChainName,
  ChainConfig,
} from '@wormhole-foundation/sdk-base';

export const NATIVE = 'native';

export type AnyContext = any;
export type RedeemResult = any;
export type SendResult = any;

export type ContextConfig = {
  [P in Platform]?: any;
};

export type WormholeConfig = {
  network: Network;
  api: string;
  chains: {
    [K in ChainName]?: ChainConfig;
  };
};

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
