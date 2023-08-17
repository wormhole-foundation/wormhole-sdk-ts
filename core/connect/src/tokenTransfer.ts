import {
  Signer,
  TokenId,
  TxHash,
  SequenceId,
  ChainContext,
  TokenTransferTransaction,
} from './types';
import { WormholeTransfer, TransferState } from './wormholeTransfer';
import { Wormhole } from './wormhole';
import { UniversalAddress, VAA } from '@wormhole-foundation/sdk-definitions';
import { ChainName } from '@wormhole-foundation/sdk-base';

export interface TokenTransferDetails {
  token: TokenId | 'native';
  amount: bigint;
  payload?: Uint8Array;
  fromChain: ChainContext;
  toChain: ChainContext;
}

export class TokenTransfer implements WormholeTransfer {
  // state machine tracker
  state: TransferState;

  wh: Wormhole;

  // transfer details
  transfer: TokenTransferDetails;

  from: UniversalAddress;
  fromSigner?: Signer;

  to: UniversalAddress;
  toSigner?: Signer;

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    emitter: UniversalAddress;
    sequence: bigint;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  constructor(
    wh: Wormhole,
    transfer: TokenTransferDetails,
    from: Signer | UniversalAddress,
    to: Signer | UniversalAddress,
  ) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    if (from instanceof UniversalAddress) {
      this.from = from;
    } else {
      this.fromSigner = from;
      this.from = transfer.fromChain.platform.parseAddress(from.address());
    }

    if (to instanceof UniversalAddress) {
      this.to = to;
    } else {
      this.toSigner = to;
      this.to = transfer.toChain.platform.parseAddress(to.address());
    }
  }

  // Static initializers for in flight transfers that have not been completed

  // init from the seq id
  static async fromIdentifier(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress,
    sequence: bigint,
  ): Promise<TokenTransfer> {
    const vaa = await wh.getVAA(chain, emitter, sequence);

    // TODO: waiting for changes to make vaa parse
    const details: TokenTransferDetails = {
      token: 'native',
      amount: 100n,
      toChain: wh.getChain('Ethereum'),
      fromChain: wh.getChain('Celo'),
    };

    return new TokenTransfer(
      wh,
      details,
      // @ts-ignore
      undefined,
      // @ts-ignore
      undefined,
    );
  }
  // init from source tx hash
  static async fromTransaction(
    wh: Wormhole,
    chain: ChainName,
    txid: string,
  ): Promise<TokenTransfer> {
    const c = wh.getChain(chain);

    const parsedTxDeets: TokenTransferTransaction[] = await c.getTransaction(
      txid,
    );

    for (const tx of parsedTxDeets) {
    }
    const [tx] = parsedTxDeets;

    const details: TokenTransferDetails = {
      token: tx.tokenId,
      amount: tx.amount,
      fromChain: wh.getChain(tx.fromChain),
      toChain: wh.getChain(tx.toChain),
    };

    const tt = new TokenTransfer(
      wh,
      details,
      details.fromChain.platform.parseAddress(tx.sender),
      details.toChain.platform.parseAddress(tx.recipient),
    );

    const emitter = details.fromChain.platform.parseAddress(tx.emitterAddress);
    //tt.sequence = tx.sequence;
    //tt.vaa = await wh.getVAA(chain, emitter, tx.sequence);

    return tt;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async start(signer?: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this (eg: state == Created)
        1) get a token transfer transaction for the token bridge given the context  
        2) sign it given the signer
        3) submit it to chain
        4) return transaction id
    */

    if (this.state !== TransferState.Created)
      throw new Error('Invalid state transition in `start`');

    const tb = await this.transfer.fromChain.getTokenBridge();

    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token[1];

    const xfer = tb.transfer(
      this.from,
      [this.transfer.toChain.chain, this.to],
      tokenAddress,
      this.transfer.amount,
      this.transfer.payload,
    );

    // TODO: check 'stackable'?
    const unsigned = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
    }

    const s = signer ? signer : this.fromSigner;
    if (s === undefined) throw new Error('No signer defined');

    const txHashes = await this.transfer.fromChain.sendWait(
      await s.sign(unsigned),
    );

    // TODO: concurrent
    const results = [];
    for (const txHash of txHashes) {
      results.push(await this.transfer.fromChain.getTransaction(txHash));
    }

    return txHashes;
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async ready(): Promise<SequenceId[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Started)
        1) poll the api on an interval to check if the VAA is available
        2) Once available, pull the VAA and parse it
        3) return seq
    */
    if (this.state < TransferState.Started || this.state > TransferState.Ready)
      throw new Error('Invalid state transition in `ready`');

    //if (this.sequence) return [this.sequence];

    throw new Error('No');
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async finish(signer?: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Ready)
        1) prepare the transactions and sign them given the signer
        2) submit the VAA and transactions on chain
        3) return txid of submission
    */
    if (this.state < TransferState.Ready)
      throw new Error('Invalid state transition in `finish`');

    // TODO: fetch it for 'em
    if (!this.vaas) throw new Error('No Vaa');

    const tb = await this.transfer.toChain.getTokenBridge();
    const xfer = tb.redeem(this.from, this.vaas[0].vaa!);

    // TODO: check 'stackable'?
    const unsigned = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
    }

    const s = signer ? signer : this.toSigner;
    if (s === undefined) throw new Error('No signer defined');

    return await this.transfer.toChain.sendWait(await s.sign(unsigned));
  }
}
