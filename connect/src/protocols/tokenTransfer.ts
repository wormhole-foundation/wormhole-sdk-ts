import {
  Signer,
  TransactionId,
  TxHash,
  UnsignedTransaction,
  VAA,
  WormholeMessageId,
  deserialize,
  isTransactionIdentifier,
  isWormholeMessageId,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../common";
import { retry } from "../tasks";
import { TokenTransferDetails, isTokenTransferDetails } from "../types";
import { Wormhole } from "../wormhole";
import {
  AttestationId,
  TransferState,
  WormholeTransfer,
} from "../wormholeTransfer";

/**
 * What do with multiple transactions or VAAs?
 * More concurrent promises instead of linearizing/blocking
 */

export class TokenTransfer implements WormholeTransfer {
  private readonly wh: Wormhole;

  // state machine tracker
  private state: TransferState;

  // transfer details
  transfer: TokenTransferDetails;

  // txids, populated once transactions are submitted
  txids: TransactionId[] = [];

  // The corresponding vaa representing the TokenTransfer
  // on the source chain (if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: VAA<"Transfer"> | VAA<"TransferWithPayload">;
  }[];

  private constructor(wh: Wormhole, transfer: TokenTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;
  }

  async getTransferState(): Promise<TransferState> {
    if (!this.transfer.automatic) return this.state;
    if (!this.vaas || this.vaas.length === 0) return this.state;

    const { chain, emitter, sequence } = this.vaas[0].id;
    const txStatus = await this.wh.getTransactionStatus(
      chain,
      emitter,
      sequence,
    );

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
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: WormholeMessageId,
    timeout?: number,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionId,
    timeout?: number,
  ): Promise<TokenTransfer>;
  static async from(
    wh: Wormhole,
    from: TokenTransferDetails | WormholeMessageId | TransactionId,
    timeout: number = 6000,
  ): Promise<TokenTransfer> {
    if (isTokenTransferDetails(from)) {
      return new TokenTransfer(wh, from);
    }

    let tt: TokenTransfer;
    if (isWormholeMessageId(from)) {
      tt = await TokenTransfer.fromIdentifier(wh, from, timeout);
    } else if (isTransactionIdentifier(from)) {
      tt = await TokenTransfer.fromTransaction(wh, from, timeout);
    } else {
      throw new Error("Invalid `from` parameter for TokenTransfer");
    }
    await tt.fetchAttestation(timeout);
    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    id: WormholeMessageId,
    timeout?: number,
  ): Promise<TokenTransfer> {
    const vaa = await TokenTransfer.getTransferVaa(wh, id, timeout);

    const { chain, address } = vaa.payload.to;
    const { relayer } = wh.conf.chains[chain]!.contracts;
    const relayerAddress = relayer
      ? // @ts-ignore
        toNative(chain, relayer).toUniversalAddress()
      : null;

    // Check if its a payload 3 targeted at a relayer on the destination chain
    const automatic =
      vaa.payloadLiteral === "TransferWithPayload" &&
      !!relayerAddress &&
      address.equals(relayerAddress);

    const token = vaa.payload.token;

    const details: TokenTransferDetails = {
      token: { chain: token.chain, address: token.address },
      amount: token.amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { chain: id.chain, address: id.emitter },
      to: { ...vaa.payload.to },
      automatic,
    };

    const tt = new TokenTransfer(wh, details);
    tt.vaas = [{ id: id, vaa }];
    tt.state = TransferState.Attested;
    return tt;
  }

  private static async fromTransaction(
    wh: Wormhole,
    from: TransactionId,
    timeout: number,
  ): Promise<TokenTransfer> {
    const msg = await TokenTransfer.getTransferMessage(wh, from, timeout);
    const tt = await TokenTransfer.fromIdentifier(wh, msg, timeout);
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

    const tokenAddress =
      this.transfer.token === "native" ? "native" : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      const tb = await fromChain.getAutomaticTokenBridge();
      const fee = await tb.getRelayerFee(
        this.transfer.from,
        this.transfer.to,
        this.transfer.token,
      );

      xfer = tb.transfer(
        this.transfer.from.address,
        this.transfer.to,
        tokenAddress,
        this.transfer.amount,
        fee,
        this.transfer.nativeGas,
      );
    } else {
      const tb = await fromChain.getTokenBridge();
      xfer = tb.transfer(
        this.transfer.from.address,
        this.transfer.to,
        tokenAddress,
        this.transfer.amount,
        this.transfer.payload,
      );
    }

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
    if (
      this.state < TransferState.Initiated ||
      this.state > TransferState.Attested
    )
      throw new Error("Invalid state transition in `ready`");

    if (!this.vaas || this.vaas.length === 0) {
      if (this.txids.length === 0) throw new Error("No txids available");

      this.vaas = await Promise.all(
        this.txids.map(async (txid: TransactionId) => {
          return { id: await TokenTransfer.getTransferMessage(this.wh, txid) };
        }),
      );
    }

    for (const idx in this.vaas) {
      // Check if we already have the VAA
      if (this.vaas[idx].vaa) continue;

      this.vaas[idx].vaa = await TokenTransfer.getTransferVaa(
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
      throw new Error(
        "Invalid state transition in `finish`. Be sure to call `fetchAttestation`.",
      );

    if (!this.vaas) throw new Error("No VAA details available");

    const toChain = this.wh.getChain(this.transfer.to.chain);

    const signerAddress = toNative(signer.chain(), signer.address());

    // TODO: when do we get >1?
    const { vaa } = this.vaas[0];
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0].id.sequence}`);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      if (vaa.payloadLiteral === "Transfer")
        throw new Error(
          "VAA is a simple transfer but expected Payload for automatic delivery",
        );

      const tb = await toChain.getAutomaticTokenBridge();
      xfer = tb.redeem(signerAddress, vaa);
    } else {
      const tb = await toChain.getTokenBridge();
      xfer = tb.redeem(signerAddress, vaa);
    }

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
    const originChain = wh.getChain(chain);

    const parsed = await retry<WormholeMessageId[]>(
      () => originChain.parseTransaction(txid),
      originChain.config.blockTime,
      timeout,
      "WormholeCore:ParseMessageFromTransaction",
    );
    if (!parsed) throw new Error(`No WormholeMessageId found for ${txid}`);

    // TODO
    if (parsed.length != 1)
      throw new Error(`Expected a single VAA, got ${parsed.length}`);
    return parsed[0];
  }

  static async getTransferVaa(
    wh: Wormhole,
    whm: WormholeMessageId,
    timeout?: number,
  ): Promise<VAA<"Transfer"> | VAA<"TransferWithPayload">> {
    const { chain, emitter, sequence } = whm;
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, timeout);
    if (!vaaBytes) throw new Error(`No VAA available after retries exhausted`);

    const partial = deserialize("Uint8Array", vaaBytes);
    switch (partial.payload[0]) {
      case 1:
        return deserialize("Transfer", vaaBytes);
      case 3:
        return deserialize("TransferWithPayload", vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }
}
