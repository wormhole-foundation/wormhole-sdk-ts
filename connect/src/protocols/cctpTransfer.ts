import { Network, Chain, Platform, encoding, circle } from "@wormhole-foundation/sdk-base";
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
} from "@wormhole-foundation/sdk-definitions";

import { signSendWait } from "../common";
import { DEFAULT_TASK_TIMEOUT } from "../config";
import { CircleTransferDetails, isCircleTransferDetails } from "../types";
import { Wormhole } from "../wormhole";
import { AttestationId, TransferState, WormholeTransfer } from "../wormholeTransfer";

export type AutomaticCircleBridgeVAA<PayloadName extends string> = ProtocolVAA<
  "AutomaticCircleBridge",
  PayloadName
>;

export class CircleTransfer<N extends Network> implements WormholeTransfer {
  private readonly wh: Wormhole<N>;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: CircleTransferDetails;

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
    vaa?: AutomaticCircleBridgeVAA<"TransferRelay">;
  }[];

  private constructor(wh: Wormhole<N>, transfer: CircleTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  async getTransferState(): Promise<TransferState> {
    //if (this.transfer.automatic) {
    //  const { chain, emitter, sequence } = this.vaas[0].id;
    //  const transactionStatus = await this.wh.getTransactionStatus(chain, emitter, sequence);
    //  // https://relayer.dev.stable.io/v1/relays?txHash=0xbe8396debdcf3bfd94c51e59abbd9e68f856a408b972d52417c41763f8eb2c0c
    //}
    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: CircleTransferDetails,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout?: number,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: CircleMessageId,
    timeout?: number,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout?: number,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: CircleTransferDetails | WormholeMessageId | CircleMessageId | TransactionId,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ): Promise<CircleTransfer<N>> {
    // This is a new transfer, just return the object
    if (isCircleTransferDetails(from)) {
      return new CircleTransfer(wh, from);
    }

    // This is an existing transfer, fetch the details
    let tt: CircleTransfer<N> | undefined;
    if (isWormholeMessageId(from)) {
      tt = await CircleTransfer.fromWormholeMessageId(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await CircleTransfer.fromTransaction(wh, from, timeout);
    } else if (isCircleMessageId(from)) {
      tt = await CircleTransfer.fromCircleMessageId(wh, from, timeout);
    } else {
      throw new Error("Invalid `from` parameter for CircleTransfer");
    }
    await tt.fetchAttestation(timeout);

    return tt;
  }

  // init from the seq id
  private static async fromWormholeMessageId<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout: number,
  ): Promise<CircleTransfer<N>> {
    const { chain, emitter, sequence } = from;
    const vaa = await CircleTransfer.getTransferVaa(wh, chain, emitter, sequence);

    const rcvAddress = vaa.payload.mintRecipient;
    const rcvChain = circle.toCircleChain(vaa.payload.targetDomain);
    // Check if its a payload 3 targeted at a relayer on the destination chain
    const { wormholeRelayer } = wh.config.chains[rcvChain]!.contracts.cctp!;

    let automatic = false;
    if (wormholeRelayer) {
      const relayerAddress = nativeChainAddress(
        chain,
        wormholeRelayer,
      ).address.toUniversalAddress();
      automatic = vaa.payloadName === "TransferRelay" && rcvAddress.equals(relayerAddress);
    }

    const details: CircleTransferDetails = {
      from: nativeChainAddress(from.chain, vaa.payload.caller),
      to: nativeChainAddress(rcvChain, rcvAddress),
      amount: vaa.payload.token.amount,
      automatic,
    };

    const tt = new CircleTransfer(wh, details);
    tt.vaas = [{ id: { emitter, sequence: vaa.sequence, chain: chain }, vaa }];
    tt.state = TransferState.Initiated;

    return tt;
  }

  private static async fromCircleMessageId<N extends Network>(
    wh: Wormhole<N>,
    messageId: CircleMessageId,
    timeout: number,
  ): Promise<CircleTransfer<N>> {
    const [message, hash] = deserializeCircleMessage(encoding.hex.decode(messageId.message));
    // If no hash is passed, set to the one we just computed
    if (messageId.hash === "") messageId.hash = hash;

    const { payload: burnMessage } = message;
    const xferSender = burnMessage.messageSender;
    const xferReceiver = burnMessage.mintRecipient;

    const sendChain = circle.toCircleChain(message.sourceDomain);
    const rcvChain = circle.toCircleChain(message.destinationDomain);

    const details: CircleTransferDetails = {
      from: nativeChainAddress(sendChain, xferSender),
      to: nativeChainAddress(rcvChain, xferReceiver),
      amount: burnMessage.amount,
      automatic: false,
    };

    const xfer = new CircleTransfer(wh, details);
    xfer.circleAttestations = [{ id: messageId }];
    xfer.state = TransferState.Initiated;

    return xfer;
  }

  // init from source tx hash
  private static async fromTransaction<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout: number,
  ): Promise<CircleTransfer<N>> {
    const { chain, txid } = from;
    const originChain = wh.getChain(chain);

    // First try to parse out a WormholeMessage
    // If we get one or more, we assume its a Wormhole attested
    // transfer
    const msgIds: WormholeMessageId[] = await originChain.parseTransaction(txid);

    // If we found a VAA message, use it
    let ct: CircleTransfer<N>;
    if (msgIds.length > 0) {
      ct = await CircleTransfer.fromWormholeMessageId(wh, msgIds[0]!, timeout);
    } else {
      // Otherwise try to parse out a circle message
      const cb = await originChain.getCircleBridge();
      const circleMessage = await cb.parseTransactionDetails(txid);
      const details: CircleTransferDetails = {
        ...circleMessage,
        // Note: assuming automatic is false since we didn't find a VAA
        automatic: false,
      };

      ct = new CircleTransfer(wh, details);
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

    let xfer: AsyncGenerator<UnsignedTransaction<N>>;
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

    this.txids = await signSendWait<N, typeof fromChain.chain>(fromChain, xfer, signer);
    this.state = TransferState.Initiated;

    return this.txids.map(({ txid }) => txid);
  }

  private async _fetchWormholeAttestation(timeout?: number): Promise<WormholeMessageId[]> {
    if (!this.vaas || this.vaas.length == 0) throw new Error("No VAA details available");

    // Check if we already have the VAA
    for (const idx in this.vaas) {
      // already got it
      if (this.vaas[idx]!.vaa) continue;

      this.vaas[idx]!.vaa = await CircleTransfer.getTransferVaa(
        this.wh,
        this.transfer.from.chain,
        this.vaas[idx]!.id.emitter,
        this.vaas[idx]!.id.sequence,
      );
    }

    return this.vaas.map((v) => v.id);
  }

  private async _fetchCircleAttestation(timeout?: number): Promise<CircleMessageId[]> {
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
      const circleMessage = await cb.parseTransactionDetails(txid!.txid);
      this.circleAttestations = [{ id: circleMessage.messageId }];
    }

    for (const idx in this.circleAttestations) {
      const ca = this.circleAttestations[idx]!;
      if (ca.attestation) continue; // already got it

      const attestation = await this.wh.getCircleAttestation(ca.id.hash, timeout);
      if (attestation === null) throw new Error("No attestation available after timeout exhausted");

      this.circleAttestations[idx]!.attestation = attestation;
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
    if (this.state < TransferState.Initiated || this.state > TransferState.Attested)
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
      if (this.vaas.length > 1) throw new Error(`Expected a VAA, found ${this.vaas.length}`);

      const { vaa } = this.vaas[0]!;
      if (!vaa) throw new Error("No VAA found");

      //const tb = await toChain.getAutomaticCircleBridge();
      //const xfer = tb.redeem(vaa);
      //const txids = await signSendWait(toChain, xfer, signer);
      throw new Error("No method to redeem auto circle bridge tx (yet)");
    }

    if (!this.circleAttestations) throw new Error("No Circle Attestations found");

    if (this.circleAttestations.length > 1)
      throw new Error(
        `Expected a single circle attestation, found ${this.circleAttestations.length}`,
      );

    const toChain = this.wh.getChain(this.transfer.to.chain);

    const { id, attestation } = this.circleAttestations[0]!;

    if (!attestation) throw new Error(`No Circle Attestation for ${id.hash}`);

    const tb = await toChain.getCircleBridge();
    const xfer = tb.redeem(this.transfer.to.address, id.message, attestation);

    const txids = await signSendWait<N, typeof toChain.chain>(toChain, xfer, signer);
    this.txids?.push(...txids);
    return txids.map(({ txid }) => txid);
  }

  static async getTransferVaa<N extends Network>(
    wh: Wormhole<N>,
    chain: Chain,
    emitter: UniversalAddress | NativeAddress<Platform>,
    sequence: bigint,
    timeout?: number,
  ): Promise<AutomaticCircleBridgeVAA<"TransferRelay">> {
    const vaa = await wh.getVaa(
      chain,
      emitter,
      sequence,
      "AutomaticCircleBridge:TransferRelay",
      timeout,
    );
    if (!vaa) throw new Error(`No VAA available after timeout exhausted`);

    return vaa;
  }
}
