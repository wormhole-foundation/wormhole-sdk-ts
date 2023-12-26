import {
  Chain,
  Network,
  Platform,
  PlatformToChains,
  ProtocolName,
} from "@wormhole-foundation/sdk-base";
import {
  Attestation,
  AttestationId,
  ChainContext,
  CircleTransferDetails,
  GatewayTransferDetails,
  Signer,
  TokenId,
  TokenTransferDetails,
  TransactionId,
  TxHash,
  VAA,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "./wormhole";

export type TransferRequest<PN extends ProtocolName = ProtocolName> = PN extends
  | "TokenBridge"
  | "AutomaticTokenBridge"
  ? TokenTransferDetails
  : PN extends "CircleBridge" | "AutomaticCircleBridge"
  ? CircleTransferDetails
  : PN extends "IbcBridge"
  ? GatewayTransferDetails
  : never;

// Transfer state machine states
export enum TransferState {
  Failed = -1,
  Created = 1, // Will be set after the TokenTransfer object is created
  SourceInitiated, // Will be set after source chain transactions are submitted
  SourceFinalized, // Will be set after source chain transactions are finalized
  Attested, // Will be set after VAA  or Circle Attestation is available
  DestinationInitiated, // Will be set after Attestation is submitted to destination chain
  DestinationFinalized, // Will be set after the transaction is finalized on the destination chain
}

export type TransferReceipt<
  PN extends ProtocolName,
  SC extends Chain = Chain,
  DC extends Chain = Chain,
> = {
  state: TransferState;
  from: SC;
  to: DC;
  originTxs: TransactionId<SC>[];
  destinationTxs: TransactionId<DC>[];
  attestation?: {
    id: AttestationId<PN>;
    attestation?: Attestation<PN>;
  };
};

// Quote with optional relayer fees if the transfer
// is requested to be automatic
export type TransferQuote = {
  // How much of what token will be deducted from sender
  // Note: This will include fees charged for a full
  // estimate of the amount taken from the sender
  sourceToken: {
    token: TokenId;
    amount: bigint;
  };
  // How much of what token will be minted to the receiver
  // Note: This will _not_ include native gas if requested
  destinationToken: {
    token: TokenId;
    amount: bigint;
  };
  // If the transfer being quoted is automatic
  // a relayer fee may apply
  relayFee?: {
    token: TokenId;
    amount: bigint;
  };
  // If the transfer being quoted asked for native gas dropoff
  // this will contain the amount of native gas that is to be minted
  // on the destination chain given the current swap rates
  destinationNativeGas?: bigint;
};

// Static methods on the Transfer protocol types
export interface TransferProtocol<PN extends ProtocolName> {
  isTransferComplete<N extends Network, P extends Platform, C extends PlatformToChains<P>>(
    toChain: ChainContext<N, P, C>,
    vaa: VAA,
  ): Promise<boolean>;
  isAutomatic<N extends Network>(wh: Wormhole<N>, vaa: VAA): boolean;
  //validateTransfer<N extends Network>(wh: Wormhole<N>, transfer: )
  quoteTransfer(xfer: WormholeTransfer<PN>): Promise<TransferQuote>;
  getReceipt(xfer: WormholeTransfer<PN>): TransferReceipt<PN>;
  track<N extends Network>(
    wh: Wormhole<N>,
    xfer: WormholeTransfer<PN>,
    timeout: number,
  ): AsyncGenerator<TransferState, TransferReceipt<PN>, unknown>;
}

// WormholeTransfer abstracts the process and state transitions
// for things like TokenTransfers, NFTTransfers, Circle (with VAA), etc...
export interface WormholeTransfer<PN extends ProtocolName> {
  transfer: TransferRequest<PN>;

  // may reach out to an external service to get the transfer state
  // return the state of this transfer
  getTransferState(): TransferState;

  // Initiate the WormholeTransfer by submitting transactions to the source chain
  // returns an array transaction hashes
  initiateTransfer(signer: Signer): Promise<TxHash[]>;

  // wait for the Attestation to be ready, timeout in ms
  // returns the sequence number
  fetchAttestation(timeout?: number): Promise<AttestationId[]>;

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hashes
  completeTransfer(signer: Signer): Promise<TxHash[]>;

  // how many blocks until source is final
  // sourceFinalized(): Promise<bigint>;
  // how many blocks until destination is final
  // destinationFinalized(): Promise<bigint>;
}
