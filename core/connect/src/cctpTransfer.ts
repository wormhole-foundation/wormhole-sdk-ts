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
  TokenTransferTransaction,
} from './types';
import { WormholeTransfer, TransferState } from './wormholeTransfer';
import { Wormhole } from './wormhole';
import {
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName } from '@wormhole-foundation/sdk-base';

/**
 * What do with multiple transactions or VAAs?
 * What do for `stackable` transactions?
 * More concurrent promises instead of linearizing/blocking
 */

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
    emitter: UniversalAddress;
    sequence: bigint;
    vaa?: VAA<'Transfer'> | VAA<'TransferWithPayload'>;
  }[];

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

    const parsedTxs: TokenTransferTransaction[] =
      await originChain.parseTransaction(txid);

    // TODO: assuming single tx
    const [tx] = parsedTxs;
    console.log(tx);
    throw new Error('fk');
    //return CCTPTransfer.fromIdentifier(wh, tx.message.msg);
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
      const tb = await fromChain.getCircleRelayer();
      xfer = tb.transfer(
        this.transfer.token,
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
      );
    } else {
      // TODO
      const tb = await fromChain.getCircleBridge();
      xfer = tb.transfer(
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
        txHashes.push(...(await fromChain.sendWait(await signer.sign([tx]))));
      }
    }

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

      this.vaas[idx].vaa = await CCTPTransfer.getTransferVaa(
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
          txHashes.push(...(await toChain.sendWait(await signer.sign([tx]))));
        }
      }
    }
    return txHashes;
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
