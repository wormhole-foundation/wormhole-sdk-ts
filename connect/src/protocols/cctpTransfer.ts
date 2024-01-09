import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  circle,
  encoding,
  toChain,
} from "@wormhole-foundation/sdk-base";
import {
  Attestation,
  AttestationId,
  AttestationReceipt,
  AutomaticCircleBridge,
  ChainContext,
  CircleBridge,
  CircleMessageId,
  CircleTransferDetails,
  Signer,
  TransactionId,
  TxHash,
  UnsignedTransaction,
  WormholeMessageId,
  isCircleMessageId,
  isCircleTransferDetails,
  isTransactionIdentifier,
  isWormholeMessageId,
} from "@wormhole-foundation/sdk-definitions";

import { signSendWait } from "../common";
import { DEFAULT_TASK_TIMEOUT } from "../config";
import { Wormhole } from "../wormhole";
import {
  AttestedTransferReceipt,
  CompletedTransferReceipt,
  SourceFinalizedTransferReceipt,
  SourceInitiatedTransferReceipt,
  TransferQuote,
  TransferReceipt,
  TransferState,
  WormholeTransfer,
  isAttested,
  isSourceFinalized,
  isSourceInitiated,
} from "../wormholeTransfer";

type CircleTransferProtocol = "CircleBridge" | "AutomaticCircleBridge";

export class CircleTransfer<N extends Network = Network>
  implements WormholeTransfer<CircleTransferProtocol>
{
  private readonly wh: Wormhole<N>;

  fromChain: ChainContext<N, Platform, Chain>;
  toChain: ChainContext<N, Platform, Chain>;

  // state machine tracker
  private _state: TransferState;

  // transfer details
  transfer: CircleTransferDetails;

  // Populated after Initialized
  txids: TransactionId[] = [];

  attestations?: AttestationReceipt<CircleTransferProtocol>[];

  private constructor(
    wh: Wormhole<N>,
    transfer: CircleTransferDetails,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ) {
    this._state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    this.fromChain = fromChain ?? wh.getChain(transfer.from.chain);
    this.toChain = toChain ?? wh.getChain(transfer.to.chain);
  }

  getTransferState(): TransferState {
    return this._state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: CircleTransferDetails,
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: string, // CircleMessage hex encoded
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout?: number,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<CircleTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: CircleTransferDetails | WormholeMessageId | string | TransactionId,
    timeout: number = DEFAULT_TASK_TIMEOUT,
    fromChain?: ChainContext<N, Platform, Chain>,
    toChain?: ChainContext<N, Platform, Chain>,
  ): Promise<CircleTransfer<N>> {
    // This is a new transfer, just return the object
    if (isCircleTransferDetails(from)) {
      return new CircleTransfer(wh, from, fromChain, toChain);
    }

    // This is an existing transfer, fetch the details
    let tt: CircleTransfer<N> | undefined;
    if (isWormholeMessageId(from)) {
      tt = await CircleTransfer.fromWormholeMessageId(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await CircleTransfer.fromTransaction(wh, from, timeout, fromChain);
    } else if (isCircleMessageId(from)) {
      tt = await CircleTransfer.fromCircleMessage(wh, from);
    } else {
      throw new Error("Invalid `from` parameter for CircleTransfer");
    }

    tt.fromChain = fromChain ?? wh.getChain(tt.transfer.from.chain);
    tt.toChain = toChain ?? wh.getChain(tt.transfer.to.chain);

    await tt.fetchAttestation(timeout);

    return tt;
  }

  // init from the seq id
  private static async fromWormholeMessageId<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout: number,
  ): Promise<CircleTransfer<N>> {
    const { chain, emitter } = from;
    const vaa = await CircleTransfer.getTransferVaa(wh, from);

    const rcvAddress = vaa.payload.mintRecipient;
    const rcvChain = circle.toCircleChain(vaa.payload.targetDomain);
    // Check if its a payload 3 targeted at a relayer on the destination chain
    const { wormholeRelayer } = wh.config.chains[rcvChain]!.contracts.cctp!;

    let automatic = false;
    if (wormholeRelayer) {
      const relayerAddress = Wormhole.chainAddress(
        chain,
        wormholeRelayer,
      ).address.toUniversalAddress();
      automatic = vaa.payloadName === "TransferWithRelay" && rcvAddress.equals(relayerAddress);
    }

    const details: CircleTransferDetails = {
      from: { chain: from.chain, address: vaa.payload.caller },
      to: { chain: rcvChain, address: rcvAddress },
      amount: vaa.payload.token.amount,
      automatic,
    };

    const tt = new CircleTransfer(wh, details);
    tt.attestations = [{ id: { emitter, sequence: vaa.sequence, chain: chain }, attestation: vaa }];
    tt._state = TransferState.Attested;

    return tt;
  }

  private static async fromCircleMessage<N extends Network>(
    wh: Wormhole<N>,
    message: string,
  ): Promise<CircleTransfer<N>> {
    const [msg, hash] = CircleBridge.deserialize(encoding.hex.decode(message));

    const { payload: burnMessage } = msg;
    const xferSender = burnMessage.messageSender;
    const xferReceiver = burnMessage.mintRecipient;

    const sendChain = circle.toCircleChain(msg.sourceDomain);
    const rcvChain = circle.toCircleChain(msg.destinationDomain);

    const details: CircleTransferDetails = {
      from: { chain: sendChain, address: xferSender },
      to: { chain: rcvChain, address: xferReceiver },
      amount: burnMessage.amount,
      automatic: false,
    };

    const xfer = new CircleTransfer(wh, details);
    xfer.attestations = [{ id: { hash }, attestation: { message: msg } }];
    xfer._state = TransferState.SourceInitiated;

    return xfer;
  }

  // init from source tx hash
  private static async fromTransaction<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout: number,
    fromChain?: ChainContext<N, Platform, Chain>,
  ): Promise<CircleTransfer<N>> {
    const { chain, txid } = from;
    fromChain = fromChain ?? wh.getChain(chain);

    // First try to parse out a WormholeMessage
    // If we get one or more, we assume its a Wormhole attested
    // transfer
    const msgIds: WormholeMessageId[] = await fromChain.parseTransaction(txid);

    // If we found a VAA message, use it
    let ct: CircleTransfer<N>;
    if (msgIds.length > 0) {
      ct = await CircleTransfer.fromWormholeMessageId(wh, msgIds[0]!, timeout);
    } else {
      // Otherwise try to parse out a circle message
      const cb = await fromChain.getCircleBridge();
      const circleMessage = await cb.parseTransactionDetails(txid);
      const details: CircleTransferDetails = {
        ...circleMessage,
        // Note: assuming automatic is false since we didn't find a VAA
        automatic: false,
      };

      ct = new CircleTransfer(wh, details);
      ct.attestations = [{ id: circleMessage.id, attestation: { message: circleMessage.message } }];
    }

    ct._state = TransferState.SourceInitiated;
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

    if (this._state !== TransferState.Created)
      throw new Error("Invalid state transition in `start`");

    let xfer: AsyncGenerator<UnsignedTransaction<N>>;
    if (this.transfer.automatic) {
      const cr = await this.fromChain.getAutomaticCircleBridge();
      xfer = cr.transfer(
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
        this.transfer.nativeGas,
      );
    } else {
      const cb = await this.fromChain.getCircleBridge();
      xfer = cb.transfer(
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
      );
    }

    this.txids = await signSendWait<N, Chain>(this.fromChain, xfer, signer);
    this._state = TransferState.SourceInitiated;

    return this.txids.map(({ txid }) => txid);
  }

  private async _fetchWormholeAttestation(timeout?: number): Promise<WormholeMessageId[]> {
    let attestations = (this.attestations ?? []) as AttestationReceipt<"AutomaticCircleBridge">[];
    if (!attestations || attestations.length == 0) throw new Error("No VAA details available");

    // Check if we already have the VAA
    for (const idx in attestations) {
      if (attestations[idx]!.attestation) continue;

      attestations[idx]!.attestation = await CircleTransfer.getTransferVaa(
        this.wh,
        attestations[idx]!.id,
        timeout,
      );
    }
    this.attestations = attestations;

    return attestations.map((v) => v.id);
  }

  private async _fetchCircleAttestation(timeout?: number): Promise<CircleMessageId[]> {
    let attestations = (this.attestations ?? []) as AttestationReceipt<"CircleBridge">[];
    if (!attestations || attestations.length == 0) {
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
      attestations = [{ id: circleMessage.id, attestation: { message: circleMessage.message } }];
    }

    for (const idx in attestations) {
      const ca = attestations[idx]!;
      if (ca.attestation?.attestation) continue; // already got it

      const attestation = await this.wh.getCircleAttestation(ca.id.hash, timeout);
      if (attestation === null) throw new Error("No attestation available after timeout exhausted");

      attestations[idx]!.attestation!.attestation = attestation;
    }

    this.attestations = attestations;

    return attestations.map((v) => v.id);
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
    if (this._state < TransferState.SourceInitiated || this._state > TransferState.Attested)
      throw new Error("Invalid state transition in `fetchAttestation`");

    const ids: AttestationId[] = this.transfer.automatic
      ? await this._fetchWormholeAttestation(timeout)
      : await this._fetchCircleAttestation(timeout);

    this._state = TransferState.Attested;

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
    if (this._state < TransferState.Attested)
      throw new Error("Invalid state transition in `finish`");

    // If its automatic, this does not need to be called
    if (this.transfer.automatic) {
      if (!this.attestations) throw new Error("No VAA details available");
      const vaa = this.attestations.find((a) =>
        isWormholeMessageId(a.id),
      ) as AttestationReceipt<"AutomaticCircleBridge">;
      if (!vaa) throw new Error("No VAA found");

      //const tb = await toChain.getAutomaticCircleBridge();
      //const xfer = tb.redeem(vaa);
      //const txids = await signSendWait(toChain, xfer, signer);
      throw new Error("No method to redeem auto circle bridge tx (yet)");
    }

    if (!this.attestations) throw new Error("No Circle Attestations found");

    const circleAttestations = this.attestations.filter((a) => isCircleMessageId(a.id));
    if (circleAttestations.length > 1)
      throw new Error(`Expected a single circle attestation, found ${circleAttestations.length}`);

    const { id, attestation } = circleAttestations[0]! as AttestationReceipt<"CircleBridge">;
    if (!attestation) throw new Error(`No Circle Attestation for ${id.hash}`);

    const { message, attestation: signatures } = attestation;
    if (!signatures) throw new Error(`No Circle Attestation for ${id.hash}`);

    const tb = await this.toChain.getCircleBridge();

    const xfer = tb.redeem(this.transfer.to.address, message, signatures!);

    const txids = await signSendWait<N, Chain>(this.toChain, xfer, signer);
    this.txids?.push(...txids);
    return txids.map(({ txid }) => txid);
  }

  static async quoteTransfer<N extends Network>(
    srcChain: ChainContext<N, Platform, Chain>,
    dstChain: ChainContext<N, Platform, Chain>,
    transfer: CircleTransferDetails,
  ): Promise<TransferQuote> {
    const dstUsdcAddress = circle.usdcContract.get(dstChain.network, dstChain.chain);
    if (!dstUsdcAddress) throw "Invalid transfer, no USDC contract on destination";

    const srcUsdcAddress = circle.usdcContract.get(srcChain.network, srcChain.chain);
    if (!srcUsdcAddress) throw "Invalid transfer, no USDC contract on source";

    const dstToken = Wormhole.chainAddress(dstChain.chain, dstUsdcAddress);
    const srcToken = Wormhole.chainAddress(srcChain.chain, srcUsdcAddress);

    if (!transfer.automatic) {
      return {
        sourceToken: { token: srcToken, amount: transfer.amount },
        destinationToken: { token: dstToken, amount: transfer.amount },
      };
    }

    // Otherwise automatic
    let dstAmount = transfer.amount;

    // If a native gas dropoff is requested, remove that from the amount they'll get
    const _nativeGas = transfer.nativeGas ? transfer.nativeGas : 0n;
    dstAmount -= _nativeGas;

    // The fee is also removed from the amount transferred
    // quoted on the source chain
    const stb = await srcChain.getAutomaticCircleBridge();
    const fee = await stb.getRelayerFee(dstChain.chain);
    dstAmount -= fee;

    // The expected destination gas can be pulled from the destination token bridge
    let destinationNativeGas = 0n;
    if (transfer.nativeGas) {
      const dtb = await dstChain.getAutomaticTokenBridge();
      destinationNativeGas = await dtb.nativeTokenAmount(dstToken.address, _nativeGas);
    }

    return {
      sourceToken: {
        token: srcToken,
        amount: transfer.amount,
      },
      destinationToken: { token: dstToken, amount: dstAmount },
      relayFee: { token: srcToken, amount: fee },
      destinationNativeGas,
    };
  }

  static async isTransferComplete<N extends Network>(
    toChain: ChainContext<N, Platform, Chain>,
    attestation: Attestation<CircleTransferProtocol>,
  ) {
    // TODO: inferring from fields what type this is, we should
    // have typeguards or require another argument to better deterimine
    if ("message" in attestation) {
      const cb = await toChain.getCircleBridge();
      return cb.isTransferCompleted(attestation.message);
    }
    throw new Error("Not implemented for automatic circle bridge");
    // const acb = await toChain.getAutomaticCircleBridge();
    // return acb.isTransferCompleted(attestation);
  }

  static async getTransferVaa<N extends Network>(
    wh: Wormhole<N>,
    wormholeMessageId: WormholeMessageId,
    timeout?: number,
  ): Promise<AutomaticCircleBridge.VAA> {
    const vaa = await wh.getVaa(
      wormholeMessageId,
      "AutomaticCircleBridge:TransferWithRelay",
      timeout,
    );
    if (!vaa) throw new Error(`No VAA available after timeout exhausted`);
    return vaa;
  }

  static async getTransferMessage<N extends Network>(
    fromChain: ChainContext<N, Platform, Chain>,
    txid: TxHash,
  ) {
    const cb = await fromChain.getCircleBridge();
    const circleMessage = await cb.parseTransactionDetails(txid);
    return circleMessage.id;
  }

  static getReceipt<N extends Network>(
    xfer: CircleTransfer<N>,
  ): TransferReceipt<CircleTransferProtocol> {
    const { from, to } = xfer.transfer;

    // This attestation may be either the auto relay vaa or the circle attestation
    // depending on the request

    let receipt: TransferReceipt<CircleTransferProtocol> = {
      protocol: xfer.transfer.automatic ? "AutomaticCircleBridge" : "CircleBridge",
      request: xfer.transfer,
      from: from.chain,
      to: to.chain,
      state: TransferState.Created,
    };

    const originTxs = xfer.txids.filter((txid) => txid.chain === xfer.transfer.from.chain);
    if (originTxs.length > 0) {
      receipt = {
        ...receipt,
        state: TransferState.SourceInitiated,
        originTxs,
      } satisfies SourceInitiatedTransferReceipt<CircleTransferProtocol>;
    }

    const att = xfer.attestations?.filter((a) => isWormholeMessageId(a.id)) ?? [];
    const ctt = xfer.attestations?.filter((a) => isCircleMessageId(a.id)) ?? [];
    const attestation = att.length > 0 ? att[0]! : ctt.length > 0 ? ctt[0]! : undefined;
    if (attestation) {
      if (attestation.id) {
        receipt = {
          ...(receipt as SourceInitiatedTransferReceipt<CircleTransferProtocol>),
          state: TransferState.SourceFinalized,
          attestation: attestation,
        } satisfies SourceFinalizedTransferReceipt<CircleTransferProtocol>;

        if (attestation.attestation) {
          receipt = {
            ...receipt,
            state: TransferState.Attested,
            attestation: { id: attestation.id, attestation: attestation.attestation },
          } satisfies AttestedTransferReceipt<CircleTransferProtocol>;
        }
      }
    }

    const destinationTxs = xfer.txids.filter((txid) => txid.chain === xfer.transfer.to.chain);
    if (destinationTxs.length > 0) {
      receipt = {
        ...(receipt as AttestedTransferReceipt<CircleTransferProtocol>),
        state: TransferState.DestinationInitiated,
        destinationTxs,
      } satisfies CompletedTransferReceipt<CircleTransferProtocol>;
    }

    return receipt;
  }

  // AsyncGenerator fn that produces status updates through an async generator
  // eventually producing a receipt
  // can be called repeatedly so the receipt is updated as it moves through the
  // steps of the transfer
  static async *track<N extends Network, SC extends Chain, DC extends Chain>(
    wh: Wormhole<N>,
    receipt: TransferReceipt<CircleTransferProtocol, SC, DC>,
    timeout: number = DEFAULT_TASK_TIMEOUT,
    // Optional parameters to override chain context (typically for custom rpc)
    _fromChain?: ChainContext<N, ChainToPlatform<SC>, SC>,
    _toChain?: ChainContext<N, ChainToPlatform<DC>, DC>,
  ) {
    const start = Date.now();
    const leftover = (start: number, max: number) => Math.max(max - (Date.now() - start), 0);

    _fromChain = _fromChain ?? wh.getChain(receipt.from);
    _toChain = _toChain ?? wh.getChain(receipt.to);

    // Check the source chain for initiation transaction
    // and capture the message id
    if (isSourceInitiated(receipt)) {
      if (receipt.originTxs.length === 0)
        throw "Invalid state transition: no originating transactions";

      const initTx = receipt.originTxs[receipt.originTxs.length - 1]!;
      const xfermsg = await CircleTransfer.getTransferMessage(_fromChain, initTx.txid);
      receipt = {
        ...receipt,
        attestation: { id: xfermsg },
        state: TransferState.SourceFinalized,
      } satisfies SourceFinalizedTransferReceipt<CircleTransferProtocol, SC, DC>;
      yield receipt;
    }

    if (isSourceFinalized(receipt)) {
      if (!receipt.attestation) throw "Invalid state transition: no attestation id";

      if (receipt.protocol === "AutomaticCircleBridge") {
        // we need to get the attestation so we can deliver it
        // we can use the message id we parsed out of the logs, if we have them
        // or try to fetch it from the last origin transaction
        let vaa = receipt.attestation.attestation ? receipt.attestation.attestation : undefined;
        if (!vaa) {
          vaa = await CircleTransfer.getTransferVaa(
            wh,
            receipt.attestation.id as WormholeMessageId,
            leftover(start, timeout),
          );
          receipt = {
            ...receipt,
            attestation: { id: receipt.attestation.id, attestation: vaa },
            state: TransferState.Attested,
          } satisfies AttestedTransferReceipt<CircleTransferProtocol, SC, DC>;
          yield receipt;
        }
      }
    }

    // First try to grab the tx status from the API
    // Note: this requires a subsequent async step on the backend
    // to have the dest txid populated, so it may be delayed by some time
    if (isAttested(receipt) || isSourceFinalized(receipt)) {
      if (!receipt.attestation) throw "Invalid state transition";
      const txStatus = await wh.getTransactionStatus(
        receipt.attestation.id as WormholeMessageId,
        leftover(start, timeout),
      );

      if (txStatus && txStatus.globalTx?.destinationTx?.txHash) {
        const { chainId, txHash } = txStatus.globalTx.destinationTx;
        receipt = {
          ...receipt,
          destinationTxs: [{ chain: toChain(chainId) as DC, txid: txHash }],
          state: TransferState.DestinationFinalized,
        } satisfies CompletedTransferReceipt<CircleTransferProtocol, SC, DC>;
        yield receipt;
      }
    }

    // Fall back to asking the destination chain if this VAA has been redeemed
    // assuming we have the full attestation
    if (isAttested(receipt)) {
      const isComplete = await CircleTransfer.isTransferComplete(
        _toChain,
        receipt.attestation.attestation,
      );
      if (isComplete) {
        receipt = {
          ...receipt,
          state: TransferState.DestinationFinalized,
          destinationTxs: [],
        } as CompletedTransferReceipt<CircleTransferProtocol, SC, DC>;
      }
      yield receipt;
    }
  }
}
