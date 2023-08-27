import {
  toCircleChainName,
  ChainName,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import {
  NativeAddress,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
  deserializePayload,
  Signer,
  TxHash,
  SequenceId,
  WormholeMessageId,
  TransactionId,
  isWormholeMessageId,
  isTransactionIdentifier,
  CircleAttestation,
  CircleMessageId,
} from '@wormhole-foundation/sdk-definitions';

import { CCTPTransferDetails, isCCTPTransferDetails } from '../types';
import { WormholeTransfer, TransferState } from '../wormholeTransfer';
import { Wormhole } from '../wormhole';

export class CCTPTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: CCTPTransferDetails;

  // Populated after Initialized
  txids?: TxHash[];

  // Populated if !automatic and after initialized
  circleAttestations?: {
    id: CircleMessageId;
    attestation?: CircleAttestation;
  }[];

  // Populated if automatic and after initialized
  vaas?: {
    id: WormholeMessageId;
    vaa?: VAA<'CircleTransferRelay'>;
  }[];

  private constructor(wh: Wormhole, transfer: CCTPTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  async getTransferState(): Promise<TransferState> {
    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(
    wh: Wormhole,
    from: CCTPTransferDetails,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<CCTPTransfer>;
  static async from(wh: Wormhole, from: TransactionId): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: CCTPTransferDetails | WormholeMessageId | TransactionId,
  ): Promise<CCTPTransfer> {
    let tt: CCTPTransfer | undefined;
    if (isWormholeMessageId(from)) {
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
    from: WormholeMessageId,
  ): Promise<CCTPTransfer> {
    const { chain, emitter, sequence } = from;
    const vaa = await CCTPTransfer.getTransferVaa(wh, chain, emitter, sequence);

    // Check if its a payload 3 targeted at a relayer on the destination chain
    const rcvAddress = vaa.payload.mintRecipient;
    const rcvChain = toCircleChainName(vaa.payload.destinationDomain);

    const automatic =
      vaa.payloadLiteral === 'CircleTransferRelay' &&
      rcvAddress.toString() === wh.conf.chains[rcvChain]?.contracts.Relayer;

    const details: CCTPTransferDetails = {
      token: {
        chain: chain,
        address: vaa.payload.token.address.toNative(chain),
      },
      amount: vaa.payload.token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { address: from.emitter, chain: from.chain },
      to: {
        chain: rcvChain,
        address: rcvAddress.toNative(rcvChain),
      },
      automatic,
    };

    const tt = new CCTPTransfer(wh, details);
    tt.vaas = [{ id: { emitter, sequence: vaa.sequence, chain: chain }, vaa }];

    tt.state = TransferState.Attested;

    return tt;
  }
  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionId,
  ): Promise<CCTPTransfer> {
    const { chain, txid } = from;
    const originChain = wh.getChain(chain);
    // First try to parse out a WormholeMessage
    // If we get one or more, we assume its a Wormhole attested
    // transfer
    const msgIds: WormholeMessageId[] = await originChain.parseTransaction(
      txid,
    );

    // If we found a VAA message, use it
    let ct: CCTPTransfer;
    if (msgIds.length > 0) {
      ct = await CCTPTransfer.fromIdentifier(wh, msgIds[0]);
    } else {
      // Otherwise try to parse out a circle message
      const cb = await originChain.getCircleBridge();
      const circleMessage = await cb.parseTransactionDetails(txid);

      const toChain = toCircleChainName(circleMessage.destination.domain);
      const toAddress = new UniversalAddress(
        circleMessage.destination.recipient,
      );

      const xferDeets: CCTPTransferDetails = {
        token: circleMessage.token,
        from: circleMessage.from,
        amount: circleMessage.amount,
        to: { chain: toChain, address: toAddress },
        // TODO: assuming automatic is false if we didnt get a VAA
        // might need to actually check the tx deets for this
        automatic: false,
      };

      ct = new CCTPTransfer(wh, xferDeets);
      ct.state = TransferState.Initiated;

      // TODO: add identifier info for circle attestation
    }

    ct.txids = [from.txid];

    return ct;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async initiateTransfer(signer: Signer): Promise<TxHash[]> {
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
      const cr = await fromChain.getAutomaticCircleBridge();
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

    this.txids = txHashes;
    this.state = TransferState.Initiated;

    return txHashes;
  }

  private async fetchWormholeAttestation(): Promise<SequenceId[]> {
    if (!this.vaas || this.vaas.length == 0)
      throw new Error('No VAA details available');

    // Check if we already have the VAA
    for (const idx in this.vaas) {
      // already got it
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await CCTPTransfer.getTransferVaa(
        this.wh,
        this.transfer.from.chain,
        this.vaas[idx].id.emitter,
        this.vaas[idx].id.sequence,
      );
    }

    return this.vaas.map((v) => {
      return v.id.sequence;
    });
  }
  private async fetchCircleAttestation(): Promise<SequenceId[]> {
    if (!this.txids || this.txids.length == 0)
      throw new Error('No Transaction IDs details available');

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    for (const txHash of this.txids) {
      const cb = await fromChain.getCircleBridge();
      const txDeets = await cb.parseTransactionDetails(txHash);
      console.log(txDeets);
      const ca = await this.wh.getCircleAttestation(txDeets.messageId.msgHash);
      console.log(ca);
    }

    // TODO
    return [];
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async fetchAttestation(timeout: number): Promise<SequenceId[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Started)
        1) poll the api on an interval to check if the VAA is available
        2) Once available, pull the VAA and parse it
        3) return seq
    */
    if (
      this.state < TransferState.Initiated ||
      this.state > TransferState.Attested
    )
      throw new Error('Invalid state transition in `fetchAttestation`');

    let seqs: SequenceId[];
    if (this.transfer.automatic) {
      seqs = await this.fetchWormholeAttestation();
    } else {
      seqs = await this.fetchCircleAttestation();
    }

    this.state = TransferState.Attested;
    return seqs;
  }

  // finish the WormholeTransfer by submitting transactions to the destination chain
  // returns a transaction hash
  async completeTransfer(signer: Signer): Promise<TxHash[]> {
    /*
        0) check that the current `state` is valid to call this  (eg: state == Ready)
        1) prepare the transactions and sign them given the signer
        2) submit the VAA and transactions on chain
        3) return txid of submission
    */
    if (this.state < TransferState.Attested)
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
            cachedVaa.id.emitter,
            cachedVaa.id.sequence,
          );

      if (!vaa) throw new Error('No Vaa found');

      let xfer: AsyncGenerator<UnsignedTransaction> | undefined;
      if (this.transfer.automatic) {
        if (vaa.payloadLiteral === 'CircleTransferRelay')
          throw new Error(
            'VAA is a simple transfer but expected Payload for automatic delivery',
          );

        const tb = await toChain.getAutomaticTokenBridge();
        //xfer = tb.redeem(this.transfer.to.address, vaa);
      } else {
        const tb = await toChain.getTokenBridge();
        //xfer = tb.redeem(this.transfer.to.address, vaa);
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
  ): Promise<VAA<'CircleTransferRelay'>> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);

    const partial = deserialize('Uint8Array', vaaBytes);

    console.log(emitter.toString());
    console.log(partial);
    console.log(deserializePayload('CircleTransferRelay', partial.payload));

    switch (partial.payload[0]) {
      case 1:
        return deserialize('CircleTransferRelay', vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }
}
