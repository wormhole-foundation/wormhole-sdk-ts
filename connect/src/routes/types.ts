import { Chain } from "@wormhole-foundation/sdk-base";
import { TransferState } from "../protocols/wormholeTransfer";
import { TokenId, TransactionId } from "@wormhole-foundation/sdk-definitions";

export interface TransferParams<OP> {
  amount: string;
  options?: OP;
}

export interface ValidatedTransferParams<OP> extends Required<TransferParams<OP>> {}

export type ValidationResult<OP> =
  | { params: ValidatedTransferParams<OP>; valid: true }
  | { params: TransferParams<OP>; valid: false; error: Error };

// Extend Options to provide custom options to use for the transfer
export interface Options {}

export interface Receipt {
  from: Chain;
  to: Chain;
  state: TransferState;
  originTxs?: TransactionId[];
  destinationTxs?: TransactionId[];
}

export interface Quote {
  sourceToken: {
    token: TokenId;
    amount: bigint;
  };
  destinationToken: {
    token: TokenId;
    amount: bigint;
  };
  relayerFee?: {
    token: TokenId;
    amount: bigint;
  };
}
