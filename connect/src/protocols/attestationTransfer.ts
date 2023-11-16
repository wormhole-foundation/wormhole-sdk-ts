// Similar to ./tokenTransfer.ts but for committing attestations about the
// a token's Metadata on the Origin chain so that the Destination chain can
// commit the data before the token is able to be transferred.
//
// Most of the code is copied from ./tokenTransfer.ts so some functionality
// hasn't been tested.
//

import {
  Signer,
  TokenBridge,
  TransactionId,
  TxHash,
  UnsignedTransaction,
  WormholeMessageId,
  isTransactionIdentifier,
  isWormholeMessageId,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../common";
import { AttestationTransferDetails, isAttestationTransferDetails } from "../types";
import { Wormhole } from "../wormhole";
import { AttestationId, TransferState, WormholeTransfer } from "../wormholeTransfer";

export class AttestationTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: AttestationTransferDetails;

  // txids, populated once transactions are submitted
  txids: TransactionId[] = [];

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: TokenBridge.VAA<"AttestMeta">;
  }[];

  private constructor(wh: Wormhole, transfer: AttestationTransferDetails) {
    if (transfer.nativeGas)
      throw new Error("Gas Dropoff is only supported for automatic transfers");

    const fromChain = wh.getChain(transfer.from.chain);
    const toChain = wh.getChain(transfer.to.chain);

    if (!fromChain.supportsTokenBridge())
      throw new Error(`Token Bridge not supported on ${transfer.from.chain}`);

    if (!toChain.supportsTokenBridge())
      throw new Error(`Token Bridge not supported on ${transfer.to.chain}`);

    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  async getTransferState(): Promise<TransferState> {
    if (!this.vaas || this.vaas.length === 0) return this.state;

    const { chain, emitter, sequence } = this.vaas[0].id;
    const txStatus = await this.wh.getTransactionStatus(chain, emitter, sequence);

    if (txStatus.globalTx.destinationTx) {
      switch (txStatus.globalTx.destinationTx.status) {
        case "completed":
          this.state = TransferState.Completed;
          break;
        // ... more?
      }
    }

    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(wh: Wormhole, from: AttestationTransferDetails): Promise<AttestationTransfer>;
  static async from(
    wh: Wormhole,
    from: WormholeMessageId,
    timeout?: number,
  ): Promise<AttestationTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionId,
    timeout?: number,
  ): Promise<AttestationTransfer>;
  static async from(
    wh: Wormhole,
    from: AttestationTransferDetails | WormholeMessageId | TransactionId,
    timeout: number = 6000,
  ): Promise<AttestationTransfer> {
    if (isAttestationTransferDetails(from)) {
      // NOTE: Hasn't tested whether this is necessary for the atte
      // Bit of (temporary) hackery until solana contracts support being
      // sent a VAA with the primary address
      if (from.to.chain === "Solana") {
        // Overwrite the dest address with the ATA
        from.to = await wh.getTokenAccount(from.from.chain, from.token, from.to);
      }

      return new AttestationTransfer(wh, from);
    }

    // TODO: Not tested yet
    let tt: AttestationTransfer;
    if (isWormholeMessageId(from)) {
      tt = await AttestationTransfer.fromIdentifier(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await AttestationTransfer.fromTransaction(wh, from, timeout);
    } else {
      throw new Error("Invalid `from` parameter for AttestationTransfer");
    }
    await tt.fetchAttestation(timeout);
    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    id: WormholeMessageId,
    timeout?: number,
  ): Promise<AttestationTransfer> {
    throw new Error("Not fully implemented and tested yet.");
    // const vaa = await AttestationTransfer.getAttestationVaa(wh, id, timeout);

    // const { token } = vaa.payload;
    // const { tokenBridgeRelayer } = wh.config.chains[chain]!.contracts;
    // const relayerAddress = tokenBridgeRelayer
    //   ? nativeChainAddress([chain, tokenBridgeRelayer]).address.toUniversalAddress()
    //   : null;

    // const details: AttestationTransferDetails = {
    //   token: { chain: token.chain, address: token.address },
    //   from: { chain: id.chain, address: id.emitter },
    //   decimals: vaa.payload.decimals,
    //   symbol: vaa.payload.symbol,
    //   name: vaa.payload.name,
    // };

    // const tt = new AttestationTransfer(wh, details);
    // tt.vaas = [{ id: id, vaa }];
    // tt.state = TransferState.Attested;
    // return tt;
  }

  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionId,
    timeout: number,
  ): Promise<AttestationTransfer> {
    const msg = await AttestationTransfer.getTransferMessage(wh, from, timeout);
    const tt = await AttestationTransfer.fromIdentifier(wh, msg, timeout);
    tt.txids = [from];
    return tt;
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

    const tokenAddress = this.transfer.token === "native" ? "native" : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);
    let xfer: AsyncGenerator<UnsignedTransaction>;

    const tb = await fromChain.getTokenBridge();
    xfer = tb.createAttestation(tokenAddress, signer.address());

    this.txids = await signSendWait(fromChain, xfer, signer);

    this.state = TransferState.Initiated;
    return this.txids.map(({ txid }) => txid);
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
      throw new Error("Invalid state transition in `ready`");

    if (!this.vaas || this.vaas.length === 0) {
      if (this.txids.length === 0)
        throw new Error("No VAAs set and txids available to look them up");

      // TODO: assuming the _last_ transaction in the list will contain the msg id
      const txid = this.txids[this.txids.length - 1];

      // parse transaction and fetch the message
      const msgId = await AttestationTransfer.getTransferMessage(this.wh, txid, timeout);
      this.vaas = [{ id: msgId }];
    }

    for (const idx in this.vaas) {
      // Check if we already have the VAA
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await AttestationTransfer.getAttestationVaa(
        this.wh,
        this.vaas[idx].id,
        timeout,
      );
    }

    this.state = TransferState.Attested;
    return this.vaas.map((v) => v.id);
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
      throw new Error("Invalid state transition in `finish`. Be sure to call `fetchAttestation`.");

    if (!this.vaas) throw new Error("No VAA details available");

    const toChain = this.wh.getChain(this.transfer.to.chain);

    // TODO: when do we get >1?
    const { vaa } = this.vaas[0];
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0].id.sequence}`);

    let xfer: AsyncGenerator<UnsignedTransaction>;

    const tb = await toChain.getTokenBridge();
    xfer = tb.submitAttestation(vaa, signer.address());

    const redeemTxids = await signSendWait(toChain, xfer, signer);
    this.txids.push(...redeemTxids);
    return redeemTxids.map(({ txid }) => txid);
  }

  static async getTransferMessage(
    wh: Wormhole,
    tx: TransactionId,
    timeout?: number,
  ): Promise<WormholeMessageId> {
    const { chain, txid } = tx;
    const msgs = await wh.parseMessageFromTx(chain, txid, timeout);
    if (msgs.length === 0) throw new Error(`No messages found in transaction ${txid}`);
    return msgs[0];
  }

  static async getAttestationVaa(
    wh: Wormhole,
    whm: WormholeMessageId,
    timeout?: number,
  ): Promise<TokenBridge.VAA<"AttestMeta">> {
    const { chain, emitter, sequence } = whm;
    const vaa = (await wh.getVaa(
      chain,
      emitter,
      sequence,
      TokenBridge.getTransferDiscriminator(),
      timeout,
    )) as TokenBridge.VAA<"TokenBridge:AttestMeta">;
    if (!vaa) throw new Error(`No VAA available after retries exhausted`);
    return vaa;
  }
}
