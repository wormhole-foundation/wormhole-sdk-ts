import { Signer, TxHash } from '@wormhole-foundation/sdk-definitions';

// Could be VAA or Circle or ..?
export type AttestationId = any;

// Transfer state machine states
export enum TransferState {
  Created = 1, // Will be set after the TokenTransfer object is created
  Initiated, // Will be set after source chain transactions are submitted
  Attested, // Will be set after VAA  or Circle Attestation is available
  Completed, // Will be set after Attestation is submitted to destination chain
  Finalized, // Will be set after the transaction is finalized on the destination chain
}

// WormholeTransfer abstracts the process and state transitions
// for things like TokenTransfers, NFTTransfers, CCTP (with VAA), etc...
export interface WormholeTransfer {
  // may reach out to an external service to get the transfer state
  // return the state of this transfer
  getTransferState(): Promise<TransferState>;

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
