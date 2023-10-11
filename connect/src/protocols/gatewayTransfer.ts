import {
  ChainName,
  PlatformName,
  chainToPlatform,
  toChainName,
} from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcTransferInfo,
  NativeAddress,
  Signer,
  TokenId,
  TransactionId,
  TxHash,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  WormholeMessageId,
  asGatewayMsg,
  deserialize,
  gatewayTransferMsg,
  isGatewayTransferDetails,
  isTransactionIdentifier,
  isWormholeMessageId,
  toNative,
  IbcBridge,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import {
  AttestationId,
  TransferState,
  WormholeTransfer,
} from "../wormholeTransfer";
import { retry } from "./retry";
import { fetchIbcXfer, isVaaRedeemed } from "./utils";

export class GatewayTransfer implements WormholeTransfer {
  static chain: ChainName = "Wormchain";

  private readonly wh: Wormhole;

  private readonly wc: ChainContext<PlatformName>;
  private readonly gatewayAddress: ChainAddress;

  // state machine tracker
  private state: TransferState;

  // cached message derived from transfer details
  // note: we dont want to create multiple different ones since
  // the nonce may change and we want to keep it consistent
  private msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg;

  // Initial Transfer Settings
  transfer: GatewayTransferDetails;

  // Transaction Ids from source chain
  transactions: TransactionId[] = [];

  // The corresponding vaa representing the GatewayTransfer
  // on the source chain (if it came from outside cosmos and if its been completed and finalized)
  vaas?: {
    id: WormholeMessageId;
    vaa?: VAA<"TransferWithPayload"> | VAA<"Transfer">;
  }[];

  // Any transfers we do over ibc
  ibcTransfers?: IbcTransferInfo[];

  private constructor(wh: Wormhole, transfer: GatewayTransferDetails) {
    this.state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    // reference from conf instead of asking the module
    // so we can prevent weird imports
    this.gatewayAddress = {
      chain: GatewayTransfer.chain,
      address: toNative(
        GatewayTransfer.chain,
        this.wh.conf.chains[GatewayTransfer.chain]!.contracts.gateway!,
      ),
    };

    // cache the wormchain chain context since we need it for checks
    this.wc = this.wh.getChain(GatewayTransfer.chain);
    this.msg = gatewayTransferMsg(this.transfer);
  }

  async getTransferState(): Promise<TransferState> {
    return this.state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from(
    wh: Wormhole,
    from: GatewayTransferDetails,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionId,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: GatewayTransferDetails | WormholeMessageId | TransactionId,
  ): Promise<GatewayTransfer> {
    // Fresh new transfer
    if (isGatewayTransferDetails(from)) {
      return new GatewayTransfer(wh, from);
    }

    // Picking up where we left off
    let gtd: GatewayTransferDetails;
    let txns: TransactionId[] = [];
    if (isTransactionIdentifier(from)) {
      txns.push(from);
      gtd = await GatewayTransfer._fromTransaction(wh, from);
    } else if (isWormholeMessageId(from)) {
      // TODO: we're missing the transaction that created this
      gtd = await GatewayTransfer._fromMsgId(wh, from);
    } else {
      throw new Error("Invalid `from` parameter for GatewayTransfer");
    }

    const gt = new GatewayTransfer(wh, gtd);
    gt.transactions = txns;

    // Since we're picking up from somewhere we can move the
    // state maching to initiated
    gt.state = TransferState.Initiated;

    // Wait for what _can_ complete to complete
    await gt.fetchAttestation();

    return gt;
  }

  // Recover Transfer info from VAA details
  private static async _fromMsgId(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<GatewayTransferDetails> {
    // Starting with the VAA
    const { chain: emitterChain, emitter, sequence } = from;
    const vaa = await GatewayTransfer.getTransferVaa(
      wh,
      emitterChain,
      emitter,
      sequence,
    );

    // The VAA may have a payload which may have a nested GatewayTransferMessage
    let payload: Uint8Array | undefined =
      vaa.payloadLiteral === "TransferWithPayload"
        ? vaa.payload.payload
        : undefined;

    // Nonce for GatewayTransferMessage may be in the payload
    // and since we use the payload to find the Wormchain transacton
    // we need to preserve it
    let nonce: number | undefined;

    let to = { ...vaa.payload.to };
    // The payload here may be the message for Gateway
    // Lets be sure to pull the real payload if its set
    // Otherwise revert to undefined
    if (payload) {
      try {
        const maybeWithPayload = asGatewayMsg(Buffer.from(payload).toString());
        nonce = maybeWithPayload.nonce;
        payload = maybeWithPayload.payload
          ? new Uint8Array(Buffer.from(maybeWithPayload.payload))
          : undefined;

        const destChain = toChainName(maybeWithPayload.chain);
        const recipientAddress = Buffer.from(
          maybeWithPayload.recipient,
          "base64",
        ).toString();

        to = {
          chain: destChain,
          // @ts-ignore
          address: toNative(destChain, recipientAddress),
        };
      } catch (e) {
        // Ignoring, throws if not the payload isnt JSON
      }
    }

    const { chain, address, amount } = vaa.payload.token;

    // Reconstruct the details
    const details: GatewayTransferDetails = {
      token: { chain, address },
      amount: amount,
      // TODO: the `from.address` here is a lie, but we don't
      // immediately have enough info to get the _correct_ one
      from: { chain: from.chain, address: from.emitter },
      to,
      nonce,
      payload: payload,
    };

    return details;
  }

  // Init from source tx hash, depending on the source chain
  // we pull Transfer info from either IBC or a wh message
  private static async _fromTransaction(
    wh: Wormhole,
    from: TransactionId,
  ): Promise<GatewayTransferDetails> {
    const { chain, txid } = from;

    const originChain = wh.getChain(chain);

    // If its origin chain is Cosmos, itll be an IBC message
    if (chainToPlatform(chain) === "Cosmwasm") {
      // Get the ibc tx info from the origin
      const ibcBridge = await originChain.getIbcBridge();
      const xfer = await ibcBridge.lookupTransferFromTx(from.txid);
      return await GatewayTransfer._fromIbcTransfer(xfer);
    }

    // Otherwise grab the vaa details from the origin tx
    const [whMsgId] = await originChain.parseTransaction(txid);
    return await GatewayTransfer._fromMsgId(wh, whMsgId);
  }

  // Recover transfer info the first step in the transfer
  private static async _fromIbcTransfer(
    xfer: IbcTransferInfo,
  ): Promise<GatewayTransferDetails> {
    const token = {
      chain: xfer.id.chain,
      address: toNative(xfer.id.chain, xfer.data.denom),
    } as TokenId;

    const msg = asGatewayMsg(xfer.data.memo);
    const destChain = toChainName(msg.chain);

    // TODO: sure it needs encoding?
    const _recip = Buffer.from(msg.recipient, "base64");
    const recipient: ChainAddress =
      chainToPlatform(destChain) === "Cosmwasm"
        ? {
            chain: destChain,
            address: toNative(destChain, _recip.toString()),
          }
        : {
            chain: destChain,
            address: toNative(
              destChain,
              new UniversalAddress(new Uint8Array(_recip)),
            ),
          };

    const payload = msg.payload
      ? new Uint8Array(Buffer.from(msg.payload))
      : undefined;

    const details: GatewayTransferDetails = {
      token,
      amount: BigInt(xfer.data.amount),
      from: {
        chain: xfer.id.chain,
        address: toNative(xfer.id.chain, xfer.data.sender),
      },
      to: recipient,
      fee: BigInt(msg.fee),
      payload,
    };

    return details;
  }

  // start the WormholeTransfer by submitting transactions to the source chain
  // returns a transaction hash
  async initiateTransfer(signer: Signer): Promise<TxHash[]> {
    /*
        0) Check current `state` is valid to call this (eg: state == Created)
        1) Figure out where to call and issue transactions  
        2) Update state
        3) return transaction ids
    */
    if (this.state !== TransferState.Created)
      throw new Error("Invalid state transition in `start`");

    this.transactions = await (this.fromGateway()
      ? this._transferIbc(signer)
      : this._transfer(signer));

    // Update State Machine
    this.state = TransferState.Initiated;

    // TODO: start thread to grab tx info?

    return this.transactions.map((tx) => tx.txid);
  }

  private async _transfer(signer: Signer): Promise<TransactionId[]> {
    const tokenAddress =
      this.transfer.token === "native" ? "native" : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    // Build the message needed to send a transfer through the gateway
    const tb = await fromChain.getTokenBridge();
    const xfer: AsyncGenerator<UnsignedTransaction> = tb.transfer(
      this.transfer.from.address,
      this.gatewayAddress,
      tokenAddress,
      this.transfer.amount,
      new Uint8Array(Buffer.from(JSON.stringify(this.msg))),
    );

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
      if (!tx.parallelizable) {
        // sign/send
        txHashes.push(
          ...(await fromChain.sendWait(await signer.sign(unsigned))),
        );
        // reset unsigned
        unsigned = [];
      }
    }

    if (unsigned.length > 0) {
      txHashes.push(...(await fromChain.sendWait(await signer.sign(unsigned))));
    }

    return txHashes.map((t) => {
      return {
        txid: t,
        chain: fromChain.chain,
      };
    });
  }

  private async _transferIbc(signer: Signer): Promise<TransactionId[]> {
    if (this.transfer.token === "native")
      throw new Error("Native not supported for IBC transfers");

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    const ibcBridge = await fromChain.getIbcBridge();
    const xfer: AsyncGenerator<UnsignedTransaction> = ibcBridge.transfer(
      this.transfer.from.address,
      this.transfer.to,
      this.transfer.token.address,
      this.transfer.amount,
    );

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for await (const tx of xfer) {
      unsigned.push(tx);
      if (!tx.parallelizable) {
        // sign/send
        txHashes.push(
          ...(await fromChain.sendWait(await signer.sign(unsigned))),
        );
        // reset unsigned
        unsigned = [];
      }
    }

    if (unsigned.length > 0) {
      txHashes.push(...(await fromChain.sendWait(await signer.sign(unsigned))));
    }

    return txHashes.map((t) => {
      return {
        txid: t,
        chain: fromChain.chain,
      };
    });
  }

  // wait for the Attestations to be ready
  async fetchAttestation(): Promise<AttestationId[]> {
    // Note: this method probably does too much

    if (
      this.state < TransferState.Initiated ||
      this.state > TransferState.Attested
    )
      throw new Error("Invalid state transition in `fetchAttestation`");

    const attestations: AttestationId[] = [];
    this.ibcTransfers = [];

    const wcIbc = await this.wc.getIbcBridge();

    // collect ibc transfers and additional transaction ids
    if (this.fromGateway()) {
      // assume all the txs are from the same chain
      // and get the ibc bridge once
      const chain = this.wh.getChain(this.transfer.from.chain);
      const bridge = await chain.getIbcBridge();

      // Ultimately we need to find the corresponding Wormchain transaction
      // from the intitiating cosmos chain, this will contain the details of the
      // outbound transaction to the destination chain

      // start by getting the IBC transfers into wormchain
      // from the cosmos chain
      this.ibcTransfers = (
        await Promise.all(
          this.transactions.map((tx) => bridge.lookupTransferFromTx(tx.txid)),
        )
      ).flat();

      // I don't know why this would happen so lmk if you see this
      if (this.ibcTransfers.length != 1) throw new Error("why?");

      // now find the corresponding wormchain transaction given the ibcTransfer info
      const xfer = this.ibcTransfers[0];
      // If we're leaving cosmos, grab the VAA from the gateway
      if (!this.toGateway()) {
        const whm = await wcIbc.lookupMessageFromIbcMsgId(xfer.id);
        const vaa = await GatewayTransfer.getTransferVaa(
          this.wh,
          whm.chain,
          whm.emitter,
          whm.sequence,
        );
        this.vaas = [{ id: whm, vaa }];

        attestations.push(whm);
      }
    } else {
      // Otherwise, we're coming from outside cosmos and
      // we need to find the wormchain ibc transaction information
      // by searching for the transaction containing the
      // GatewayTransferMsg
      const { chain, txid } = this.transactions[0];
      const [whm] = await this.wh.parseMessageFromTx(chain, txid);
      const vaa = await GatewayTransfer.getTransferVaa(
        this.wh,
        whm.chain,
        whm.emitter,
        whm.sequence,
      );
      this.vaas = [{ id: whm, vaa }];

      attestations.push(whm);

      // TODO: conf for these settings? how do we choose them?
      const retryInterval = 2000;

      // Wait until the vaa is redeemed before trying to look up the
      // transfer message
      const wcTb = await this.wc.getTokenBridge();
      const isRedeemedTask = () => isVaaRedeemed(wcTb, [vaa]);
      const redeemed = await retry<boolean>(isRedeemedTask, retryInterval);
      if (!redeemed) throw new Error("VAA not found after retries exhausted");

      // Finally, get the IBC transactions from wormchain
      // Note: Because we search by GatewayTransferMsg payload
      // there is a possibility of dupe messages being returned
      // using a nonce should help
      const wcTransferTask = () => fetchIbcXfer(wcIbc, this.msg);
      const wcTransfer = await retry<IbcTransferInfo>(
        wcTransferTask,
        retryInterval,
      );
      if (!wcTransfer)
        throw new Error("Wormchain transfer not found after retries exhausted");

      this.ibcTransfers.push(wcTransfer);
    }

    // Add transfers to attestations we return
    // Note: there is no ordering guarantee here
    attestations.push(...this.ibcTransfers.map((xfer) => xfer.id));

    this.state = TransferState.Attested;

    return attestations;
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

    if (this.toGateway())
      // TODO: Return the txids from the final transfers?
      //return this.ibcTransfers?.map((xfer) => xfer.tx.txid) ?? [];
      throw new Error(
        "Complete transfer is not necessary for Gateway supported chains",
      );

    if (!this.vaas) throw new Error("No VAA details available to redeem");

    const { chain, address } = this.transfer.to;

    const toChain = this.wh.getChain(chain);
    const toAddress = address.toUniversalAddress();

    const tb = await toChain.getTokenBridge();

    let unsigned: UnsignedTransaction[] = [];
    const txHashes: TxHash[] = [];
    for (const cachedVaa of this.vaas) {
      const { vaa } = cachedVaa;

      if (!vaa) throw new Error(`No VAA found for ${cachedVaa.id.sequence}`);

      const xfer: AsyncGenerator<UnsignedTransaction> = tb.redeem(
        toAddress,
        vaa,
      );
      for await (const tx of xfer) {
        unsigned.push(tx);
        // If we find a tx that is not parallelizable, sign it and send
        // the accumulated txs so far
        if (!tx.parallelizable) {
          txHashes.push(
            ...(await toChain.sendWait(await signer.sign(unsigned))),
          );
          // reset unsigned
          unsigned = [];
        }
      }
    }

    if (unsigned.length > 0) {
      txHashes.push(...(await toChain.sendWait(await signer.sign(unsigned))));
    }
    return txHashes;
  }

  static async getTransferVaa(
    wh: Wormhole,
    chain: ChainName,
    emitter: UniversalAddress | NativeAddress<PlatformName>,
    sequence: bigint,
    retries: number = 5,
  ): Promise<VAA<"TransferWithPayload"> | VAA<"Transfer">> {
    const vaaBytes = await wh.getVAABytes(chain, emitter, sequence, retries);
    if (!vaaBytes) throw new Error(`No VAA available after ${retries} retries`);

    const partial = deserialize("Uint8Array", vaaBytes);
    switch (partial.payload[0]) {
      case 1:
        return deserialize("Transfer", vaaBytes);
      case 3:
        return deserialize("TransferWithPayload", vaaBytes);
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }

  // TODO: Is this a good enough check for what we want to do?
  private fromGateway(): boolean {
    //IbcBridge.getChannels();

    return chainToPlatform(this.transfer.from.chain) === "Cosmwasm";
    // return networkChainToChannelId.has(
    //   this.wh.network,
    //   this.transfer.from.chain,
    // );
  }
  private toGateway(): boolean {
    return chainToPlatform(this.transfer.to.chain) === "Cosmwasm";
    // return networkChainToChannelId.has(this.wh.network, this.transfer.to.chain);
  }
}
