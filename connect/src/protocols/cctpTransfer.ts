import {
  toCircleChainName,
  ChainName,
  PlatformName,
} from "@wormhole-foundation/sdk-base";
import {
  NativeAddress,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  deserialize,
  Signer,
  TxHash,
  WormholeMessageId,
  TransactionId,
  isWormholeMessageId,
  isTransactionIdentifier,
  CircleAttestation,
  CircleMessageId,
  toNative,
} from "@wormhole-foundation/sdk-definitions";

import { CCTPTransferDetails, isCCTPTransferDetails } from "../types";
import {
  WormholeTransfer,
  TransferState,
  AttestationId,
} from "../wormholeTransfer";
import { Wormhole } from "../wormhole";

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
    vaa?: VAA<"CircleTransferRelay">;
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
      throw new Error("Invalid `from` parameter for CCTPTransfer");

    return tt;
  }

  // init from the seq id
  private static async fromIdentifier(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<CCTPTransfer> {
    const { chain, emitter, sequence } = from;
    const vaa = await CCTPTransfer.getTransferVaa(wh, chain, emitter, sequence);

    const rcvAddress = vaa.payload.mintRecipient;
    const rcvChain = toCircleChainName(vaa.payload.targetDomain);
    // Check if its a payload 3 targeted at a relayer on the destination chain
    const { wormholeRelayer } = wh.conf.chains[rcvChain]!.contracts.cctp!;

    let automatic = false;
    if (wormholeRelayer) {
      const relayerAddress = toNative(chain, wormholeRelayer);

      automatic =
        vaa.payloadLiteral === "CircleTransferRelay" &&
        // @ts-ignore
        rcvAddress.equals(relayerAddress.toUniversalAddress());
    }

    const details: CCTPTransferDetails = {
      token: {
        chain: chain,
        address: vaa.payload.token.address.toNative(chain),
      },
      amount: vaa.payload.token.amount,
      from: { address: vaa.payload.caller, chain: from.chain },
      to: {
        chain: rcvChain,
        address: rcvAddress,
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
      // TODO: fromCircleIdentifier?

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
      ct.circleAttestations = [{ id: circleMessage.messageId }];
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
      throw new Error("Invalid state transition in `start`");

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    let xfer: AsyncGenerator<UnsignedTransaction>;
    if (this.transfer.automatic) {
      const cr = await fromChain.getAutomaticCircleBridge();
      xfer = cr.transfer(
        this.transfer.token,
        this.transfer.from.address,
        { chain: this.transfer.to.chain, address: this.transfer.to.address },
        this.transfer.amount,
        this.transfer.nativeGas,
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

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
      if (!tx.parallelizable) {
        const signed = await signer.sign(unsigned);
        txHashes.push(...(await fromChain.sendWait(signed)));
        unsigned = [];
      }
    }
    if (unsigned.length > 0) {
      const signed = await signer.sign(unsigned);
      txHashes.push(...(await fromChain.sendWait(signed)));
    }

    this.txids = txHashes;
    this.state = TransferState.Initiated;

    return txHashes;
  }

  private async fetchWormholeAttestation(): Promise<WormholeMessageId[]> {
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

    return this.vaas.map((v) => {
      return v.id;
    });
  }

  private async fetchCircleAttestation(): Promise<CircleMessageId[]> {
    if (!this.circleAttestations || this.circleAttestations.length == 0)
      throw new Error("No Attestation IDs details available");

    for (const idx in this.circleAttestations) {
      const ca = this.circleAttestations[idx];
      // already got it
      if (ca.attestation) continue;

      this.circleAttestations[idx].attestation =
        await this.wh.getCircleAttestation(ca.id.msgHash);
    }

    return this.circleAttestations.map((v) => {
      return v.id;
    });
  }

  // wait for the VAA to be ready
  // returns the sequence number
  async fetchAttestation(timeout: number): Promise<AttestationId[]> {
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

    let ids: AttestationId[];
    if (this.transfer.automatic) {
      ids = await this.fetchWormholeAttestation();
    } else {
      ids = await this.fetchCircleAttestation();
    }

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

    if (this.transfer.automatic) {
      if (!this.vaas) throw new Error("No VAA details available");

      const toChain = this.wh.getChain(this.transfer.to.chain);

      const txHashes: TxHash[] = [];
      for (const cachedVaa of this.vaas) {
        const { vaa } = cachedVaa;
        if (!vaa) throw new Error("No Vaa found");
        const tb = await toChain.getAutomaticCircleBridge();
        //TODO: tb.redeem()
        throw new Error("No method to redeem auto circle bridge tx (yet)");
      }
      return txHashes;
    } else {
      if (!this.circleAttestations)
        throw new Error("No Circle Attestation details available");

      const toChain = this.wh.getChain(this.transfer.to.chain);

      const txHashes: TxHash[] = [];
      for (const cachedAttestation of this.circleAttestations) {
        const { id, attestation } = cachedAttestation;

        if (!attestation)
          throw new Error(`No Circle Attestation for ${id.msgHash}`);

        const tb = await toChain.getCircleBridge();
        const xfer = tb.redeem(
          this.transfer.to.address,
          id.message,
          attestation,
        );

        let unsigned: UnsignedTransaction[] = [];
        for await (const tx of xfer) {
          unsigned.push(tx);

          // If we get a non-parallelizable tx, sign and send the transactions
          // we've gotten so far
          if (!tx.parallelizable) {
            const signed = await signer.sign(unsigned);
            const txHashes = await toChain.sendWait(signed);
            txHashes.push(...txHashes);
            // reset unsigned
            unsigned = [];
          }
        }

        if (unsigned.length > 0) {
          const signed = await signer.sign(unsigned);
          const txHashes = await toChain.sendWait(signed);
          txHashes.push(...txHashes);
        }
      }
      return txHashes;
    }
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<"CircleTransferRelay">> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);
    const partial = deserialize("Uint8Array", vaaBytes);
    switch (partial.payload[0]) {
      case 1:
        return deserialize("CircleTransferRelay", vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }
}
