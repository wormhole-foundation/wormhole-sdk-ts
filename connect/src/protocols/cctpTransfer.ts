import {
  ChainName,
  PlatformName,
  toCircleChainName,
  encoding,
} from "@wormhole-foundation/sdk-base";
import {
  CircleAttestation,
  CircleMessageId,
  NativeAddress,
  ProtocolVAA,
  Signer,
  TransactionId,
  TxHash,
  UniversalAddress,
  UnsignedTransaction,
  WormholeMessageId,
  deserializeCircleMessage,
  isCircleMessageId,
  isTransactionIdentifier,
  isWormholeMessageId,
  nativeChainAddress,
  toNative,
} from "@wormhole-foundation/sdk-definitions";

import { signSendWait } from "../common";
import { DEFAULT_TASK_TIMEOUT } from "../config";
import { CCTPTransferDetails, isCCTPTransferDetails } from "../types";
import { Wormhole } from "../wormhole";
import {
  AttestationId,
  TransferState,
  WormholeTransfer,
} from "../wormholeTransfer";

export type CCTPVAA<PayloadName extends string> = ProtocolVAA<
  "CCTP",
  PayloadName
>;

export class CCTPTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: CCTPTransferDetails;

  // Populated after Initialized
  txids: TransactionId[] = [];

  // Populated if !automatic and after initialized
  circleAttestations?: {
    id: CircleMessageId;
    attestation?: CircleAttestation;
  }[];

  // Populated if automatic and after initialized
  vaas?: {
    id: WormholeMessageId;
    vaa?: CCTPVAA<"TransferRelay">;
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
    timeout?: number,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: CircleMessageId,
    timeout?: number,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionId,
    timeout?: number,
  ): Promise<CCTPTransfer>;
  static async from(
    wh: Wormhole,
    from:
      | CCTPTransferDetails
      | WormholeMessageId
      | CircleMessageId
      | TransactionId,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<CCTPTransfer> {
    // This is a new transfer, just return the object
    if (isCCTPTransferDetails(from)) {
      return new CCTPTransfer(wh, from);
    }

    // This is an existing transfer, fetch the details
    let tt: CCTPTransfer | undefined;
    if (isWormholeMessageId(from)) {
      tt = await CCTPTransfer.fromWormholeMessageId(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await CCTPTransfer.fromTransaction(wh, from, timeout);
    } else if (isCircleMessageId(from)) {
      tt = await CCTPTransfer.fromCircleMessageId(wh, from, timeout);
    } else {
      throw new Error("Invalid `from` parameter for CCTPTransfer");
    }
    await tt.fetchAttestation(timeout);

    return tt;
  }

  // init from the seq id
  private static async fromWormholeMessageId(
    wh: Wormhole,
    from: WormholeMessageId,
    timeout: number,
  ): Promise<CCTPTransfer> {
    const { chain, emitter, sequence } = from;
    const vaa = await CCTPTransfer.getTransferVaa(wh, chain, emitter, sequence);

    const rcvAddress = vaa.payload.mintRecipient;
    const rcvChain = toCircleChainName(vaa.payload.targetDomain);
    // Check if its a payload 3 targeted at a relayer on the destination chain
    const { wormholeRelayer } = wh.conf.chains[rcvChain]!.contracts.cctp!;

    let automatic = false;
    if (wormholeRelayer) {
      const relayerAddress = toNative(
        chain,
        wormholeRelayer,
        //@ts-ignore
      ).toUniversalAddress();
      automatic =
        vaa.payloadName === "TransferRelay" &&
        rcvAddress.equals(relayerAddress);
    }

    const details: CCTPTransferDetails = {
      from: nativeChainAddress([from.chain, vaa.payload.caller]),
      to: nativeChainAddress([rcvChain, rcvAddress]),
      amount: vaa.payload.token.amount,
      automatic,
    };

    const tt = new CCTPTransfer(wh, details);
    tt.vaas = [{ id: { emitter, sequence: vaa.sequence, chain: chain }, vaa }];
    tt.state = TransferState.Initiated;

    return tt;
  }

  // TODO: should be allowed to be partial msg,
  // we can recover from either the msg or msghash
  private static async fromCircleMessageId(
    wh: Wormhole,
    messageId: CircleMessageId,
    timeout: number,
  ): Promise<CCTPTransfer> {
    const [message, hash] = deserializeCircleMessage(
      encoding.hex.decode(messageId.message),
    );
    // If no hash is passed, set to the one we just computed
    if (messageId.hash === "") messageId.hash = hash;

    const { payload: burnMessage } = message;
    const xferSender = burnMessage.messageSender;
    const xferReceiver = burnMessage.mintRecipient;

    const sendChain = toCircleChainName(message.sourceDomain);
    const rcvChain = toCircleChainName(message.destinationDomain);

    const details: CCTPTransferDetails = {
      from: nativeChainAddress([sendChain, xferSender]),
      to: nativeChainAddress([rcvChain, xferReceiver]),
      amount: burnMessage.amount,
      automatic: false,
    };

    const xfer = new CCTPTransfer(wh, details);
    xfer.circleAttestations = [{ id: messageId }];
    xfer.state = TransferState.Initiated;

    return xfer;
  }

  // init from source tx hash
  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionId,
    timeout: number,
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
      ct = await CCTPTransfer.fromWormholeMessageId(wh, msgIds[0], timeout);
    } else {
      // Otherwise try to parse out a circle message
      const cb = await originChain.getCircleBridge();
      const circleMessage = await cb.parseTransactionDetails(txid);
      const details: CCTPTransferDetails = {
        ...circleMessage,
        // Note: assuming automatic is false since we didn't find a VAA
        automatic: false,
      };

      ct = new CCTPTransfer(wh, details);
      ct.circleAttestations = [{ id: circleMessage.messageId }];
    }

    ct.state = TransferState.Initiated;
    ct.txids = [from];
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
      throw new Error("Invalid state transition in `start`");

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      const cr = await fromChain.getAutomaticCircleBridge();
      xfer = cr.transfer(
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
        this.transfer.nativeGas,
      );
    } else {
      const cb = await fromChain.getCircleBridge();
      xfer = cb.transfer(
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
      );
    }

    this.txids = await signSendWait(fromChain, xfer, signer);
    this.state = TransferState.Initiated;

    return this.txids.map(({ txid }) => txid);
  }

  private async _fetchWormholeAttestation(
    timeout?: number,
  ): Promise<WormholeMessageId[]> {
    if (!this.vaas || this.vaas.length == 0)
      throw new Error("No VAA details available");

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

    return this.vaas.map((v) => v.id);
  }

  private async _fetchCircleAttestation(
    timeout?: number,
  ): Promise<CircleMessageId[]> {
    if (!this.circleAttestations || this.circleAttestations.length == 0) {
      // If we dont have any circle attestations yet, we need to start by
      // fetching the transaction details from the source chain
      if (this.txids.length === 0)
        throw new Error("No circle attestations or transactions to fetch");

      // The last tx should be the circle transfer, its possible there was
      // a contract spend approval transaction
      const txid = this.txids[this.txids?.length - 1];
      const fromChain = this.wh.getChain(this.transfer.from.chain);

      const cb = await fromChain.getCircleBridge();
      const circleMessage = await cb.parseTransactionDetails(txid.txid);
      this.circleAttestations = [{ id: circleMessage.messageId }];
    }

    for (const idx in this.circleAttestations) {
      const ca = this.circleAttestations[idx];
      if (ca.attestation) continue; // already got it

      const attestation = await this.wh.getCircleAttestation(
        ca.id.hash,
        timeout,
      );
      if (attestation === null)
        throw new Error("No attestation available after timeout exhausted");

      this.circleAttestations[idx].attestation = attestation;
    }

    return this.circleAttestations.map((v) => v.id);
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
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
      throw new Error("Invalid state transition in `fetchAttestation`");

    const ids: AttestationId[] = this.transfer.automatic
      ? await this._fetchWormholeAttestation(timeout)
      : await this._fetchCircleAttestation(timeout);

    this.state = TransferState.Attested;

    return ids;
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
      throw new Error("Invalid state transition in `finish`");

    // If its automatic, this does not need to be called
    if (this.transfer.automatic) {
      if (!this.vaas) throw new Error("No VAA details available");
      if (this.vaas.length > 1)
        throw new Error(`Expected a VAA, found ${this.vaas.length}`);

      const { vaa } = this.vaas[0];
      if (!vaa) throw new Error("No VAA found");

      //const tb = await toChain.getAutomaticCircleBridge();
      //const xfer = tb.redeem(vaa);
      //const txids = await signSendWait(toChain, xfer, signer);
      throw new Error("No method to redeem auto circle bridge tx (yet)");
    }

    if (!this.circleAttestations)
      throw new Error("No Circle Attestations found");

    if (this.circleAttestations.length > 1)
      throw new Error(
        `Expected a single circle attestation, found ${this.circleAttestations.length}`,
      );

    const toChain = this.wh.getChain(this.transfer.to.chain);

    const { id, attestation } = this.circleAttestations[0];

    if (!attestation) throw new Error(`No Circle Attestation for ${id.hash}`);

    const tb = await toChain.getCircleBridge();
    const xfer = tb.redeem(this.transfer.to.address, id.message, attestation);

    const txids = await signSendWait(toChain, xfer, signer);
    this.txids?.push(...txids);
    return txids.map(({ txid }) => txid);
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    timeout?: number,
  ): Promise<CCTPVAA<"TransferRelay">> {
    const vaa = await wh.getVAA(
      chain,
      emitter,
      sequence,
      "CCTP:TransferRelay",
      timeout,
    );
    if (!vaa) throw new Error(`No VAA available after timeout exhausted`);

    return vaa;
  }
}
