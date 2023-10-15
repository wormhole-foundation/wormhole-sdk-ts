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
  IbcBridge,
  IbcTransferInfo,
  Signer,
  TokenId,
  TransactionId,
  TxHash,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  WormholeMessageId,
  deserialize,
  gatewayTransferMsg,
  isGatewayTransferDetails,
  isTransactionIdentifier,
  isWormholeMessageId,
  nativeChainAddress,
  serialize,
  toGatewayMsg,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import {
  AttestationId,
  TransferState,
  WormholeTransfer,
} from "../wormholeTransfer";
import { retry } from "./retry";
import { fetchIbcXfer, isTokenBridgeVaaRedeemed } from "./tasks";
import { signSendWait } from "./common";

export class GatewayTransfer implements WormholeTransfer {
  static chain: ChainName = "Wormchain";

  private readonly wh: Wormhole;

  // Wormchain context
  private readonly gateway: ChainContext<PlatformName>;
  // Wormchain IBC Bridge
  private readonly gatewayIbcBridge: IbcBridge<PlatformName>;
  // Contract address
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

  private constructor(
    wh: Wormhole,
    transfer: GatewayTransferDetails,
    gateway: ChainContext<PlatformName>,
    gatewayIbc: IbcBridge<PlatformName>,
  ) {
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
    this.gateway = gateway;
    this.gatewayIbcBridge = gatewayIbc;

    // cache the message since we don't want to regenerate it any time we need it
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
    timeout?: number,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: TransactionId,
    timeout?: number,
  ): Promise<GatewayTransfer>;
  static async from(
    wh: Wormhole,
    from: GatewayTransferDetails | WormholeMessageId | TransactionId,
    timeout?: number,
  ): Promise<GatewayTransfer> {
    // we need this regardless of the type of `from`
    const wc = wh.getChain(GatewayTransfer.chain);
    const wcibc = await wc.getIbcBridge();

    // Fresh new transfer
    if (isGatewayTransferDetails(from)) {
      return new GatewayTransfer(wh, from, wc, wcibc);
    }

    // Picking up where we left off
    let gtd: GatewayTransferDetails;
    let txns: TransactionId[] = [];
    if (isTransactionIdentifier(from)) {
      txns.push(from);
      gtd = await GatewayTransfer._fromTransaction(wh, from);
    } else if (isWormholeMessageId(from)) {
      // TODO: we're missing the transaction that created this
      // get it from transaction status search on wormholescan?
      gtd = await GatewayTransfer._fromMsgId(wh, from);
    } else {
      throw new Error("Invalid `from` parameter for GatewayTransfer");
    }

    const gt = new GatewayTransfer(wh, gtd, wc, wcibc);
    gt.transactions = txns;

    // Since we're picking up from somewhere we can move the
    // state maching to initiated
    gt.state = TransferState.Initiated;

    // Wait for what _can_ complete to complete
    await gt.fetchAttestation(timeout);

    return gt;
  }

  // Recover Transfer info from VAA details
  private static async _fromMsgId(
    wh: Wormhole,
    from: WormholeMessageId,
  ): Promise<GatewayTransferDetails> {
    // Starting with the VAA
    const vaa = await GatewayTransfer.getTransferVaa(wh, from);

    // The VAA may have a payload which may have a nested GatewayTransferMessage
    let payload: Uint8Array | undefined =
      vaa.payloadLiteral === "TransferWithPayload"
        ? vaa.payload.payload
        : undefined;

    // Nonce for GatewayTransferMessage may be in the payload
    // and since we use the payload to find the Wormchain transacton
    // we need to preserve it
    let nonce: number | undefined;

    let to: ChainAddress = { ...vaa.payload.to };
    // The payload here may be the message for Gateway
    // Lets be sure to pull the real payload if its set
    // Otherwise revert to undefined
    if (payload) {
      try {
        const maybeWithPayload = toGatewayMsg(Buffer.from(payload).toString());
        nonce = maybeWithPayload.nonce;
        payload = maybeWithPayload.payload
          ? new Uint8Array(Buffer.from(maybeWithPayload.payload))
          : undefined;

        const destChain = toChainName(maybeWithPayload.chain);
        const recipientAddress = Buffer.from(
          maybeWithPayload.recipient,
          "base64",
        ).toString();

        to = nativeChainAddress([destChain, recipientAddress]);
      } catch {
        /*Ignoring, throws if not the payload isnt JSON*/
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

    // If its origin chain is Cosmos, it should be an IBC message
    // but its not all the time so do this differently?
    // check if the chain supports gateway?
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

    const msg = toGatewayMsg(xfer.data.memo);
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

    return signSendWait(fromChain, xfer, signer);
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

    return signSendWait(fromChain, xfer, signer);
  }

  // TODO: track the time elapsed and subtract it from the timeout passed with
  // successive updates
  // wait for the Attestations to be ready
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    // Note: this method probably does too much

    if (
      this.state < TransferState.Initiated ||
      this.state > TransferState.Attested
    )
      throw new Error("Invalid state transition in `fetchAttestation`");

    const attestations: AttestationId[] = [];
    this.ibcTransfers = [];

    // collect ibc transfers and additional transaction ids
    if (this.fromGateway()) {
      // assume all the txs are from the same chain
      // and get the ibc bridge once
      const chain = this.wh.getChain(this.transfer.from.chain);
      const originIbcbridge = await chain.getIbcBridge();

      // Ultimately we need to find the corresponding Wormchain transaction
      // from the intitiating cosmos chain, this will contain the details of the
      // outbound transaction to the destination chain

      // start by getting the IBC transfers into wormchain
      // from the cosmos chain
      this.ibcTransfers = (
        await Promise.all(
          this.transactions.map((tx) =>
            originIbcbridge.lookupTransferFromTx(tx.txid),
          ),
        )
      ).flat();

      // I don't know why this would happen so lmk if you see this
      if (this.ibcTransfers.length != 1) throw new Error("why?");

      // If we're leaving cosmos, grab the VAA from the gateway
      if (!this.toGateway()) {
        const [xfer] = this.ibcTransfers;

        // now find the corresponding wormchain transaction given the ibcTransfer info
        const retryInterval = 5000;
        const task = () =>
          this.gatewayIbcBridge.lookupMessageFromIbcMsgId(xfer.id);
        const whm = await retry<WormholeMessageId>(
          task,
          retryInterval,
          timeout,
          "Gateway:IbcBridge:LookupWormholeMessageFromIncomingIbcMessage",
        );
        if (!whm)
          throw new Error(
            "Matching wormhole message not found after retries exhausted",
          );

        const vaa = await GatewayTransfer.getTransferVaa(this.wh, whm);
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
      const vaa = await GatewayTransfer.getTransferVaa(this.wh, whm);
      this.vaas = [{ id: whm, vaa }];

      attestations.push(whm);

      // TODO: conf for these settings? how do we choose them?
      const vaaRedeemedRetryInterval = 2000;
      const transferCompleteInterval = 5000;

      // Wait until the vaa is redeemed before trying to look up the
      // transfer message
      const wcTb = await this.gateway.getTokenBridge();
      // Since we want to retry until its redeemed, return null
      // in the case that its not redeemed
      const isRedeemedTask = () => isTokenBridgeVaaRedeemed(wcTb, vaa);
      const redeemed = await retry<boolean>(
        isRedeemedTask,
        vaaRedeemedRetryInterval,
        timeout,
        "Gateway:TokenBridge:IsVaaRedeemed",
      );
      if (!redeemed)
        throw new Error("VAA not redeemed after retries exhausted");

      // Next, get the IBC transactions from wormchain
      // Note: Because we search by GatewayTransferMsg payload
      // there is a possibility of dupe messages being returned
      // using a nonce should help
      const wcTransferTask = () =>
        fetchIbcXfer(this.gatewayIbcBridge, this.msg);
      const wcTransfer = await retry<IbcTransferInfo>(
        wcTransferTask,
        vaaRedeemedRetryInterval,
        timeout,
        "Gateway:IbcBridge:WormchainTransferInitiated",
      );
      if (!wcTransfer)
        throw new Error("Wormchain transfer not found after retries exhausted");

      this.ibcTransfers.push(wcTransfer);

      // Finally, get the IBC transfer to the destination chain
      const destChain = this.wh.getChain(this.transfer.to.chain);
      const destIbcBridge = await destChain.getIbcBridge();
      const destTransferTask = () => fetchIbcXfer(destIbcBridge, wcTransfer.id);
      const destTransfer = await retry<IbcTransferInfo>(
        destTransferTask,
        transferCompleteInterval,
        timeout,
        "Destination:IbcBridge:WormchainTransferCompleted",
      );
      if (!destTransfer)
        throw new Error(
          "IBC Transfer into destination not found after retries exhausted" +
            JSON.stringify(wcTransfer.id),
        );

      this.ibcTransfers.push(destTransfer);
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
    if (this.vaas.length > 1) throw new Error("Expected 1 vaa");

    const { chain, address } = this.transfer.to;

    const toChain = this.wh.getChain(chain);
    // TODO: these could be different, but when?
    //const signerAddress = toNative(signer.chain(), signer.address());
    const toAddress = address.toUniversalAddress();

    const tb = await toChain.getTokenBridge();

    const { vaa } = this.vaas[0];
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0].id.sequence}`);

    const xfer: AsyncGenerator<UnsignedTransaction> = tb.redeem(toAddress, vaa);
    const redeemTxs = await signSendWait(toChain, xfer, signer);
    this.transactions.push(...redeemTxs);

    return redeemTxs.map(({ txid }) => txid);
  }

  static async getTransferVaa(
    wh: Wormhole,
    whm: WormholeMessageId,
  ): Promise<VAA<"TransferWithPayload"> | VAA<"Transfer">> {
    const { chain, emitter, sequence } = whm;

    const partial = await wh.getVAA(chain, emitter, sequence, "Uint8Array");

    if (!partial)
      throw new Error(`No VAA Available: ${chain}/${emitter}/${sequence}`);

    switch (partial.payload[0]) {
      case 1:
        return deserialize("Transfer", serialize(partial));
      case 3:
        return deserialize("TransferWithPayload", serialize(partial));
    }
    throw new Error(`No serde defined for type: ${partial.payload[0]}`);
  }

  // Implicitly determine if the chain is Gateway enabled by
  // checking to see if the Gateway IBC bridge has a transfer channel setup
  // If this is a new chain, add the channels to the constants file
  private fromGateway(): boolean {
    return (
      this.gatewayIbcBridge.getTransferChannel(this.transfer.from.chain) !==
      null
    );
  }
  private toGateway(): boolean {
    return (
      this.gatewayIbcBridge.getTransferChannel(this.transfer.to.chain) !== null
    );
  }
}
