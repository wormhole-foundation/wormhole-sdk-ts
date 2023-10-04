import { ChainId, Network } from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  TransactionId,
  WormholeMessageId,
  TokenId,
  ChainsConfig,
} from '@wormhole-foundation/sdk-definitions';

export type WormholeConfig = {
  network: Network;
  api: string;
  circleAPI: string;
  chains: ChainsConfig;
};

export type TokenTransferDetails = {
  token: TokenId | 'native';
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

export type CCTPTransferDetails = {
  token: TokenId;
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
  nativeGas?: bigint;
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
