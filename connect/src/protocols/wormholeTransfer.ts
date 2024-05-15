import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type {
  AttestationId,
  ChainContext,
  CircleTransferDetails,
  GatewayTransferDetails,
  ProtocolName,
  Signer,
  TokenTransferDetails,
  TxHash,
} from "@wormhole-foundation/sdk-definitions";
import type {
  AttestationReceipt,
  TransferQuote,
  TransferReceipt,
  TransferState,
} from "../types.js";
import type { Wormhole } from "../wormhole.js";

export type TransferRequest<PN extends ProtocolName = ProtocolName> = PN extends
  | "TokenBridge"
  | "AutomaticTokenBridge"
  ? TokenTransferDetails
  : PN extends "CircleBridge" | "AutomaticCircleBridge"
  ? CircleTransferDetails
  : PN extends "IbcBridge"
  ? GatewayTransferDetails
  : never;

// Static methods on the Transfer protocol types
// e.g. `TokenTransfer`
export interface TransferProtocol<PN extends ProtocolName> {
  isTransferComplete<N extends Network, C extends Chain>(
    toChain: ChainContext<N, C>,
    attestation: AttestationId<PN>,
  ): Promise<boolean>;
  validateTransferDetails<N extends Network>(
    wh: Wormhole<N>,
    transfer: TransferRequest<PN>,
  ): Promise<void>;
  quoteTransfer(xfer: WormholeTransfer<PN>): Promise<TransferQuote>;
  getReceipt(xfer: WormholeTransfer<PN>): TransferReceipt<AttestationReceipt<PN>>;
  track<N extends Network>(
    wh: Wormhole<N>,
    xfer: TransferReceipt<AttestationReceipt<PN>>,
    timeout: number,
  ): AsyncGenerator<TransferReceipt<AttestationReceipt<PN>>>;
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
}
