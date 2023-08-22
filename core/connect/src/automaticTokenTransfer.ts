import {
  Signer,
  TxHash,
  SequenceId,
  TokenTransferDetails,
  TokenTransferTransaction,
  MessageIdentifier,
  TransactionIdentifier,
  isMessageIdentifier,
  isTokenTransferDetails,
  isTransactionIdentifier,
} from './types';
import { AutomaticWormholeTransfer, TransferState } from './wormholeTransfer';
import { Wormhole } from './wormhole';
import {
  TokenBridge,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName, PlatformName } from '@wormhole-foundation/sdk-base';

/**
 * What do with multiple transactions or VAAs?
 * What do for `stackable` transactions?
 * More concurrent promises instead of linearizing/blocking
 */

export class AutomaticTokenTransfer implements AutomaticWormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

  fromSigner?: Signer;
  private fromTokenBridge?: TokenBridge<PlatformName>;

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    emitter: UniversalAddress;
    sequence: bigint;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  private constructor(wh: Wormhole, transfer: TokenTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  transferState(): TransferState {
    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails,
  ): Promise<AutomaticTokenTransfer>;
  static async from(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<AutomaticTokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<AutomaticTokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails | MessageIdentifier | TransactionIdentifier,
  ): Promise<AutomaticTokenTransfer> {
    let tt: AutomaticTokenTransfer | undefined;

    if (isMessageIdentifier(from)) {
      tt = await AutomaticTokenTransfer.fromIdentifier(wh, from);
    } else if (isTransactionIdentifier(from)) {
      tt = await AutomaticTokenTransfer.fromTransaction(wh, from);
    } else if (isTokenTransferDetails(from)) {
      tt = new AutomaticTokenTransfer(wh, from);
    }

    if (tt === undefined)
      throw new Error('Invalid `from` parameter for TokenTransfer');

    // cache token bridges
    const fromChain = wh.getChain(tt.transfer.from.chain);
    tt.fromTokenBridge = await fromChain.getTokenBridge();

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<AutomaticTokenTransfer> {
    const { chain, address: emitter, sequence } = from;
    const vaa = await AutomaticTokenTransfer.getTransferVaa(
      wh,
      chain,
      emitter,
      sequence,
    );

    const details: TokenTransferDetails = {
      token: { ...vaa.payload.token },
      amount: vaa.payload.token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { ...from },
      to: { ...vaa.payload.to },
    };

    const tt = new AutomaticTokenTransfer(wh, details);
    tt.vaas = [{ emitter, sequence: vaa.sequence, vaa }];

    tt.state = TransferState.Ready;

    return tt;
  }
  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<AutomaticTokenTransfer> {
    const { chain, txid } = from;

    const c = wh.getChain(chain);

    const parsedTxDeets: TokenTransferTransaction[] = await c.parseTransaction(
      txid,
    );

    // TODO: assuming single tx
    const [tx] = parsedTxDeets;

    const tt = new AutomaticTokenTransfer(wh, tx.details);
    tt.state = TransferState.Started;

    const { address: emitter, sequence } = tx.message.msg;
    const vaa = await AutomaticTokenTransfer.getTransferVaa(
      wh,
      chain,
      emitter,
      sequence,
    );

    tt.vaas = [{ emitter, sequence, vaa }];
    tt.state = TransferState.Ready;
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

    const tokenAddress =
      this.transfer.token === 'native' ? 'native' : this.transfer.token.address;

    const xfer = this.fromTokenBridge!.transfer(
      this.transfer.from.address,
      { chain: this.transfer.to.chain, address: this.transfer.to.address },
      tokenAddress,
      this.transfer.amount,
      this.transfer.payload,
    );

    // TODO: check 'stackable'?
    const unsigned: UnsignedTransaction[] = [];
    for await (const tx of xfer) {
      if (!tx.stackable) {
        // sign/send
      }
      unsigned.push(tx);
    }

    const s = signer ? signer : this.fromSigner;
    if (s === undefined) throw new Error('No signer defined');

    const fromChain = this.wh.getChain(this.transfer.from.chain);
    const txHashes = await fromChain.sendWait(await s.sign(unsigned));

    this.state = TransferState.Started;

    // TODO: concurrent
    for (const txHash of txHashes) {
      const txRes = await fromChain.parseTransaction(txHash);

      // TODO:
      if (txRes.length != 1) throw new Error('Idk what to do with != 1');
      const [tx] = txRes;

      const { address: emitter, sequence } = tx.message.msg;

      if (!this.vaas) this.vaas = [];
      this.vaas.push({ emitter: emitter, sequence: sequence });
    }

    return txHashes;
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<'Transfer'>> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);
    return deserialize('Transfer', vaaBytes);
  }
}
