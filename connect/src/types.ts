import { Network, Platform } from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainsConfig,
  TokenId,
  TransactionId,
  WormholeMessageId,
} from "@wormhole-foundation/sdk-definitions";

export type WormholeConfig<N extends Network = Network, P extends Platform = Platform> = {
  api: string;
  circleAPI: string;
  chains: ChainsConfig<N, P>;
};

export type TokenTransferDetails = {
  token: TokenId | "native";
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

export type CircleTransferDetails = {
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

export type CircleTransferTransaction = {
  message?: WormholeMessage;
  details: CircleTransferDetails;
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

export function isCircleTransferDetails(
  thing: CircleTransferDetails | any,
): thing is TokenTransferDetails {
  return (
    (<CircleTransferDetails>thing).amount !== undefined &&
    (<CircleTransferDetails>thing).from !== undefined &&
    (<CircleTransferDetails>thing).to !== undefined
  );
}
