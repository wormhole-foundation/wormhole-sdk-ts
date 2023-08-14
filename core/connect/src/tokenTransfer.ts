import { Signer, TokenId, TxHash, SequenceId } from './types';
import { WormholeTransfer, TransferState } from './wormholeTransfer';
import { Wormhole } from './wormhole';
import { UniversalAddress, VAA } from '@wormhole-foundation/sdk-definitions';
import { ChainName } from '@wormhole-foundation/sdk-base';

export interface TokenTransferDetails {
  token: TokenId | 'native';
  amount: bigint;
  payload?: Uint8Array;
}

export class TokenTransfer implements WormholeTransfer {
  // state machine tracker
  state: TransferState;

  wh: Wormhole;

  // transfer details
  transfer: TokenTransferDetails;
  source: Signer;
  destination: Signer;

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaa?: {
    chain: ChainName;
    emitter: UniversalAddress;
    sequence: bigint;
    vaa?: VAA;
  };

  constructor(
    wh: Wormhole,
    transfer: TokenTransferDetails,
    from: Signer,
    to: Signer,
  ) {
    this.wh = wh;
    this.transfer = transfer;
    this.source = from;
    this.destination = to;
    this.state = TransferState.Created;
  }

  // Static initializers for in flight transfers that have not been completed

  // init from the seq id
  static async fromIdentifier(
    chain: ChainName,
    seq: bigint,
  ): Promise<TokenTransfer> {
    throw new Error('Not implemented');
    //return new TokenTransfer();
  }
  // init from source tx hash
  static async fromTransaction(
    chain: ChainName,
    txid: string,
  ): Promise<TokenTransfer> {
    throw new Error('Not implemented');
    //return new TokenTransfer();
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async start(signer?: Signer): Promise<TxHash> {
    /*
        0) check that the current `state` is valid to call this (eg: state == Created)
        1) get a token transfer transaction for the token bridge given the context  
        2) sign it given the signer
        3) submit it to chain
        4) return transaction id
    */

    return '0xdeadbeef';
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async ready(): Promise<SequenceId> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Started)
        1) poll the api on an interval to check if the VAA is available
        2) Once available, pull the VAA and parse it
        3) return seq
    */
    return 0n;
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async finish(signer?: Signer): Promise<TxHash> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Ready)
        1) prepare the transactions and sign them given the signer
        2) submit the VAA and transactions on chain
        3) return txid of submission
    */
    return '0xdeadbeef';
  }
}
