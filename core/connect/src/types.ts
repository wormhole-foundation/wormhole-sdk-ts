import {
  Network,
  ChainName,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  TransactionId,
  WormholeMessageId,
  TokenId,
  Platform,
  ChainContext,
} from '@wormhole-foundation/sdk-definitions';

import { ChainConfig } from './constants';

export type PlatformCtr = {
  _platform: PlatformName;
  new (network: Network, conf: ChainsConfig): Platform;
};
export type ChainCtr = new () => ChainContext;

export type ChainsConfig = {
  [K in ChainName]?: ChainConfig;
};
export type WormholeConfig = {
  network: Network;
  api: string;
  chains: ChainsConfig;
};

export type TokenTransferDetails = {
  token: TokenId | 'native';
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
};

export type CCTPTransferDetails = {
  token: TokenId;
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
};

export type WormholeMessage = {
  tx: TransactionId;
  msg: WormholeMessageId;
  payloadId: bigint;
};

// Details for a source chain Token Transfer transaction
export type TokenTransferTransaction = {
  message: WormholeMessage;
  details: TokenTransferDetails;
  block: bigint;
  gasFee: bigint;
};

export type CCTPTransferTransaction = {
  message?: WormholeMessage;
  details: CCTPTransferDetails;
  block: bigint;
  gasFee: bigint;
};
export function isTokenTransferDetails(
  thing: TokenTransferDetails | any,
): thing is TokenTransferDetails {
  return (
    (<TokenTransferDetails>thing).token !== undefined &&
    (<TokenTransferDetails>thing).amount !== undefined &&
    (<TokenTransferDetails>thing).from !== undefined &&
    (<TokenTransferDetails>thing).to !== undefined
  );
}

export function isCCTPTransferDetails(
  thing: CCTPTransferDetails | any,
): thing is TokenTransferDetails {
  return (
    (<CCTPTransferDetails>thing).amount !== undefined &&
    (<CCTPTransferDetails>thing).from !== undefined &&
    (<CCTPTransferDetails>thing).to !== undefined
  );
}
