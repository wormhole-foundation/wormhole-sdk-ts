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
import { WormholeTransfer, TransferState } from './wormholeTransfer';
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

export class TokenTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

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
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails | MessageIdentifier | TransactionIdentifier,
  ): Promise<TokenTransfer> {
    let tt: TokenTransfer | undefined;

    if (isMessageIdentifier(from)) {
      tt = await TokenTransfer.fromIdentifier(wh, from);
    } else if (isTransactionIdentifier(from)) {
      tt = await TokenTransfer.fromTransaction(wh, from);
    } else if (isTokenTransferDetails(from)) {
      tt = new TokenTransfer(wh, from);
    }

    if (tt === undefined)
      throw new Error('Invalid `from` parameter for TokenTransfer');

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<TokenTransfer> {
    const { chain, address: emitter, sequence } = from;
    const vaa = await TokenTransfer.getTransferVaa(
      wh,
      chain,
      emitter,
      sequence,
    );

    // TODO: actually check
    let automatic = false;
    if (vaa.payload.to.address.toString() === 'TODO') automatic = true;

    const details: TokenTransferDetails = {
      token: { ...vaa.payload.token },
      amount: vaa.payload.token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { ...from },
      to: { ...vaa.payload.to },
      automatic,
    };

    const tt = new TokenTransfer(wh, details);
    tt.vaas = [{ emitter, sequence: vaa.sequence, vaa }];

    tt.state = TransferState.Ready;

    return tt;
  }
  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<TokenTransfer> {
    const { chain, txid } = from;

    const c = wh.getChain(chain);

    const parsedTxDeets: TokenTransferTransaction[] = await c.parseTransaction(
      txid,
    );

    // TODO: assuming single tx
    const [tx] = parsedTxDeets;

    const tt = new TokenTransfer(wh, tx.details);
    tt.state = TransferState.Started;

    const { address: emitter, sequence } = tx.message.msg;
    const vaa = await TokenTransfer.getTransferVaa(
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
  async start(signer: Signer): Promise<TxHash[]> {
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

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      const tb = await fromChain.getAutomaticTokenBridge();
      xfer = tb.transfer(
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        tokenAddress,
        this.transfer.amount,
      );
    } else {
      const tb = await fromChain.getTokenBridge();
      xfer = tb.transfer(
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        tokenAddress,
        this.transfer.amount,
        this.transfer.payload,
      );
    }

    // TODO: check 'stackable'?
    const unsigned: UnsignedTransaction[] = [];
    for await (const tx of xfer) {
      if (!tx.stackable) {
        // sign/send
      }
      unsigned.push(tx);
    }

    const txHashes = await fromChain.sendWait(await signer.sign(unsigned));

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

    if (!this.vaas || this.vaas.length == 0)
      throw new Error('No VAA details available');

    // Check if we already have the VAA
    for (const idx in this.vaas) {
      // already got it
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await TokenTransfer.getTransferVaa(
        this.wh,
        this.transfer.from.chain,
        this.vaas[idx].emitter,
        this.vaas[idx].sequence,
      );
    }

    this.state = TransferState.Ready;
    return this.vaas.map((v) => {
      return v.sequence;
    });
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async finish(signer: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Ready)
        1) prepare the transactions and sign them given the signer
        2) submit the VAA and transactions on chain
        3) return txid of submission
    */
    if (this.state < TransferState.Ready)
      throw new Error('Invalid state transition in `finish`');

    // TODO: fetch it for 'em? We should _not_ be Ready if we dont have these
    if (!this.vaas) throw new Error('No VAA details available');

    const toChain = this.wh.getChain(this.transfer.to.chain);

    const unsigned: UnsignedTransaction[] = [];
    for (const cachedVaa of this.vaas) {
      const vaa = cachedVaa.vaa
        ? cachedVaa.vaa
        : await TokenTransfer.getTransferVaa(
            this.wh,
            this.transfer.from.chain,
            cachedVaa.emitter,
            cachedVaa.sequence,
          );

      if (!vaa) throw new Error('No Vaa found');

      let xfer: AsyncGenerator<UnsignedTransaction> | undefined;
      if (this.transfer.automatic) {
        if (vaa.payloadLiteral === 'Transfer')
          throw new Error(
            'VAA is a simple transfer but expected Payload for automatic delivery',
          );

        const tb = await toChain.getAutomaticTokenBridge();
        xfer = tb.redeem(this.transfer.to.address, vaa);
      } else {
        const tb = await toChain.getTokenBridge();
        xfer = tb.redeem(this.transfer.to.address, vaa);
      }

      // TODO: better error
      if (xfer === undefined)
        throw new Error('No handler defined for VAA type');

      // TODO: check 'stackable'?
      for await (const tx of xfer) {
        unsigned.push(tx);
      }
    }

    return await toChain.sendWait(await signer.sign(unsigned));
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<'Transfer'> | VAA<'TransferWithPayload'>> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);
    return deserialize('Transfer', vaaBytes);
  }
}
