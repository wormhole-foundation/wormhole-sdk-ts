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

//

// GatewayTransferMsg is the message sent in the payload of a TokenTransfer
// to be executed by the Gateway contract.
export interface GatewayTransferMsg {
  gateway_transfer: {
    chain: ChainId;
    recipient: string;
    fee: string;
    nonce: number;
  };
}

export function isGatewayTransferMsg(
  thing: GatewayTransferMsg | any,
): thing is GatewayTransferMsg {
  return (<GatewayTransferMsg>thing).gateway_transfer !== undefined;
}

// GatewayTransferWithPayloadMsg is the message sent in the payload of a
// TokenTransfer with its own payload to be executed by the Gateway contract.
export interface GatewayTransferWithPayloadMsg {
  gateway_transfer_with_payload: {
    chain: ChainId;
    recipient: string;
    fee: string;
    nonce: number;
    payload: string;
  };
}

export function isGatewayTransferWithPayloadMsg(
  thing: GatewayTransferWithPayloadMsg | any,
): thing is GatewayTransferWithPayloadMsg {
  return (
    (<GatewayTransferWithPayloadMsg>thing).gateway_transfer_with_payload !==
    undefined
  );
}

export type GatewayTransferDetails = {
  token: TokenId | 'native';
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

export function isGatewayTransferDetails(
  thing: GatewayTransferDetails | any,
): thing is GatewayTransferDetails {
  return (
    (<GatewayTransferDetails>thing).token !== undefined &&
    (<GatewayTransferDetails>thing).amount !== undefined &&
    (<GatewayTransferDetails>thing).from !== undefined &&
    (<GatewayTransferDetails>thing).to !== undefined
  );
}
