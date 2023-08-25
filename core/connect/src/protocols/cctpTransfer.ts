import {
  Signer,
  TxHash,
  SequenceId,
  MessageIdentifier,
  TransactionIdentifier,
  isMessageIdentifier,
  isTransactionIdentifier,
  CCTPTransferDetails,
  isCCTPTransferDetails,
} from '../types';
import { WormholeTransfer, TransferState } from '../wormholeTransfer';
import { Wormhole } from '../wormhole';
import {
  NativeAddress,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
  toNative,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName, PlatformName } from '@wormhole-foundation/sdk-base';

export class CCTPTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: CCTPTransferDetails;

  // attestation from circle (obv)
  circleAttestation?: string;

  // The corresponding vaa representing the CCTPTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    emitter: UniversalAddress | NativeAddress<PlatformName>;
    sequence: bigint;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

  txids?: TxHash[];

  private constructor(wh: Wormhole, transfer: CCTPTransferDetails) {
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
    from: CCTPTransferDetails,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: CCTPTransferDetails | MessageIdentifier | TransactionIdentifier,
  ): Promise<CCTPTransfer> {
    let tt: CCTPTransfer | undefined;

    if (isMessageIdentifier(from)) {
      tt = await CCTPTransfer.fromIdentifier(wh, from);
    } else if (isTransactionIdentifier(from)) {
      tt = await CCTPTransfer.fromTransaction(wh, from);
    } else if (isCCTPTransferDetails(from)) {
      tt = new CCTPTransfer(wh, from);
    }

    if (tt === undefined)
      throw new Error('Invalid `from` parameter for CCTPTransfer');

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: MessageIdentifier,
  ): Promise<CCTPTransfer> {
    const { chain, address: emitter, sequence } = from;
    const vaa = await CCTPTransfer.getTransferVaa(wh, chain, emitter, sequence);

    // Check if its a payload 3 targeted at a relayer on the destination chain
    const rcv = vaa.payload.to;
    const automatic =
      vaa.payloadLiteral === 'TransferWithPayload' &&
      rcv.address.toString() === wh.conf.chains[rcv.chain]?.contracts.Relayer;

    const details: CCTPTransferDetails = {
      token: vaa.payload.token,
      amount: vaa.payload.token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { ...from },
      to: { ...vaa.payload.to },
      automatic,
    };

    const tt = new CCTPTransfer(wh, details);
    tt.vaas = [{ emitter, sequence: vaa.sequence, vaa }];

    tt.state = TransferState.Ready;

    return tt;
  }
  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionIdentifier,
  ): Promise<CCTPTransfer> {
    const { chain, txid } = from;
    const originChain = wh.getChain(chain);
    // TODO: assumes VAA
    const parsedMsgIdent: MessageIdentifier[] =
      await originChain.parseTransaction(txid);
    // If we found a VAA message, use it
    if (parsedMsgIdent.length !== 0)
      return CCTPTransfer.fromIdentifier(wh, parsedMsgIdent[0]);

    // Otherwise try to parse out a circle message
    const cb = await originChain.getCircleBridge();
    const circleMessage = await cb.parseTransactionDetails(txid);
    console.log(circleMessage);

    // TODO
    throw new Error('Not implemented');
    // return new CCTPTransfer(wh, {
    //   // token:
    //   amount: circleMessage.amount,
    //   //from: {
    //   //  chain: circleMessage.fromChain,
    //   //  address: toNative('Evm', circleMessage.depositor).toUniversalAddress(),
    //   //},
    //   //to: {
    //   //  chain: 'Ethereum',
    //   //  address: circleMessage.destination.recipient,
    //   //},
    //   automatic: false,
    // });
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

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      const cr = await fromChain.getCircleRelayer();
      xfer = cr.transfer(
        this.transfer.token,
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
      );
    } else {
      const cb = await fromChain.getCircleBridge();
      xfer = cb.transfer(
        this.transfer.token,
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
      );
    }

    // TODO: definitely a bug here, we _only_ send when !stackable
    const txHashes: TxHash[] = [];
    for await (const tx of xfer) {
      if (!tx.stackable) {
        // sign/send/wait
        const signed = await signer.sign([tx]);
        const txHashes = await fromChain.sendWait(signed);
        txHashes.push(...txHashes);
      } else {
        // TODO: prolly should do something with these
      }
    }

    console.log(txHashes);

    this.txids = txHashes;
    this.state = TransferState.Started;

    return txHashes;
  }

  private async readyAutomatic(): Promise<SequenceId[]> {
    if (!this.vaas || this.vaas.length == 0)
      throw new Error('No VAA details available');

    // Check if we already have the VAA
    for (const idx in this.vaas) {
      // already got it
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await CCTPTransfer.getTransferVaa(
        this.wh,
        this.transfer.from.chain,
        this.vaas[idx].emitter,
        this.vaas[idx].sequence,
      );
    }

    return this.vaas.map((v) => {
      return v.sequence;
    });
  }
  private async readyManual(): Promise<SequenceId[]> {
    if (!this.txids || this.txids.length == 0)
      throw new Error('No Transaction IDs details available');

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    for (const txHash of this.txids) {
      const cb = await fromChain.getCircleBridge();
      const txDeets = await cb.parseTransactionDetails(txHash);
      console.log(txDeets);
      const ca = this.wh.getCircleAttestation(txDeets.messageHash.toString());
      console.log(ca);
    }

    // TODO
    return [];
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

    let seqs: SequenceId[];
    if (this.transfer.automatic) {
      seqs = await this.readyAutomatic();
    } else {
      seqs = await this.readyManual();
    }

    this.state = TransferState.Ready;
    return seqs;
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

    const txHashes: TxHash[] = [];
    for (const cachedVaa of this.vaas) {
      const vaa = cachedVaa.vaa
        ? cachedVaa.vaa
        : await CCTPTransfer.getTransferVaa(
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

      // TODO: definitely a bug here, we _only_ send when !stackable
      for await (const tx of xfer) {
        if (!tx.stackable) {
          const signed = await signer.sign([tx]);
          const txHashes = await toChain.sendWait(signed);
          txHashes.push(...txHashes);
        } else {
          // TODO...
        }
      }
    }
    return txHashes;
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<'Transfer'> | VAA<'TransferWithPayload'>> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);

    const partial = deserialize('Uint8Array', vaaBytes);
    switch (partial.payload[0]) {
      case 1:
        return deserialize('Transfer', vaaBytes);
      case 3:
        return deserialize('TransferWithPayload', vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }
}
