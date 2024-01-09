import {
  ChainToPlatform,
  Network,
  chainToPlatform,
  encoding,
  toChain,
  PlatformToChains,
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
  TokenBridge,
  TokenId,
  TransactionId,
  TxHash,
  UniversalAddress,
  WormholeMessageId,
  gatewayTransferMsg,
  isGatewayTransferDetails,
  isTransactionIdentifier,
  isWormholeMessageId,
  toGatewayMsg,
  toNative,
  AttestationId,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../common";
import { fetchIbcXfer, isTokenBridgeVaaRedeemed, retry } from "../tasks";
import { Wormhole } from "../wormhole";
import { TransferState, WormholeTransfer } from "../wormholeTransfer";

type GatewayContext<N extends Network> = ChainContext<
  N,
  ChainToPlatform<typeof GatewayTransfer.chain>,
  typeof GatewayTransfer.chain
>;

export class GatewayTransfer<N extends Network = Network> implements WormholeTransfer<"IbcBridge"> {
  static chain: "Wormchain" = "Wormchain";

  private readonly wh: Wormhole<N>;

  // Wormchain context
  private readonly gateway: GatewayContext<N>;
  // Wormchain IBC Bridge
  private readonly gatewayIbcBridge: IbcBridge<N, "Cosmwasm", PlatformToChains<"Cosmwasm">>;
  // Contract address
  private readonly gatewayAddress: ChainAddress;

  // state machine tracker
  private _state: TransferState;

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
    vaa?: TokenBridge.TransferVAA;
  }[];

  // Any transfers we do over ibc
  ibcTransfers: IbcTransferInfo[] = [];

  private constructor(
    wh: Wormhole<N>,
    transfer: GatewayTransferDetails,
    gateway: GatewayContext<N>,
    gatewayIbc: IbcBridge<N, "Cosmwasm", PlatformToChains<"Cosmwasm">>,
  ) {
    this._state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    // reference from conf instead of asking the module
    // so we can prevent weird imports
    this.gatewayAddress = {
      chain: GatewayTransfer.chain,
      address: toNative(
        GatewayTransfer.chain,
        this.wh.config.chains[GatewayTransfer.chain]!.contracts.gateway!,
      ),
    };

    // cache the wormchain chain context since we need it for checks
    this.gateway = gateway;
    this.gatewayIbcBridge = gatewayIbc;

    // cache the message since we don't want to regenerate it any time we need it
    this.msg = gatewayTransferMsg(this.transfer);
  }

  getTransferState(): TransferState {
    return this._state;
  }

  // Static initializers for in flight transfers that have not been completed
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: GatewayTransferDetails,
  ): Promise<GatewayTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout?: number,
  ): Promise<GatewayTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout?: number,
  ): Promise<GatewayTransfer<N>>;
  static async from<N extends Network>(
    wh: Wormhole<N>,
    from: GatewayTransferDetails | WormholeMessageId | TransactionId,
    timeout?: number,
  ): Promise<GatewayTransfer<N>> {
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
    gt._state = TransferState.SourceInitiated;

    // Wait for what _can_ complete to complete
    await gt.fetchAttestation(timeout);

    return gt;
  }

  // Recover Transfer info from VAA details
  private static async _fromMsgId<N extends Network>(
    wh: Wormhole<N>,
    from: WormholeMessageId,
    timeout?: number,
  ): Promise<GatewayTransferDetails> {
    // Starting with the VAA
    const vaa = await GatewayTransfer.getTransferVaa(wh, from, timeout);

    // The VAA may have a payload which may have a nested GatewayTransferMessage
    let payload: Uint8Array | undefined =
      vaa.payloadName === "TransferWithPayload" ? vaa.payload.payload : undefined;

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
        const maybeWithPayload = toGatewayMsg(encoding.bytes.decode(payload));
        nonce = maybeWithPayload.nonce;
        payload = maybeWithPayload.payload
          ? encoding.bytes.encode(maybeWithPayload.payload)
          : undefined;

        const destChain = toChain(maybeWithPayload.chain);
        // b64 decode the address to its string representation
        const recipientAddress = encoding.bytes.decode(
          encoding.b64.decode(maybeWithPayload.recipient),
        );
        to = Wormhole.chainAddress(destChain, recipientAddress);
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
  private static async _fromTransaction<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    timeout?: number,
  ): Promise<GatewayTransferDetails> {
    const { chain, txid } = from;

    const originChain = wh.getChain(chain);

    // If its origin chain is Cosmos, it should be an IBC message
    // but its not all the time so do this differently?
    // TODO: check if the chain supports Gateway protocol?
    if (chainToPlatform(chain) === "Cosmwasm") {
      // Get the ibc tx info from the origin
      const ibcBridge = await originChain.getIbcBridge();
      const xfer = await ibcBridge.lookupTransferFromTx(from.txid);
      return GatewayTransfer.ibcTransfertoGatewayTransfer(xfer);
    }

    // Otherwise grab the vaa details from the origin tx
    const [whMsgId] = await originChain.parseTransaction(txid);
    return await GatewayTransfer._fromMsgId(wh, whMsgId!, timeout);
  }

  // Recover transfer info the first step in the transfer
  private static ibcTransfertoGatewayTransfer(xfer: IbcTransferInfo): GatewayTransferDetails {
    const token = {
      chain: xfer.id.chain,
      address: toNative(xfer.id.chain, xfer.data.denom),
    } as TokenId;

    const msg = toGatewayMsg(xfer.data.memo);
    const destChain = toChain(msg.chain);

    const _recip = encoding.b64.valid(msg.recipient)
      ? encoding.bytes.decode(encoding.b64.decode(msg.recipient))
      : msg.recipient;
    const recipient: ChainAddress =
      chainToPlatform(destChain) === "Cosmwasm"
        ? {
            chain: destChain,
            address: toNative(destChain, _recip.toString()),
          }
        : {
            chain: destChain,
            address: toNative(destChain, new UniversalAddress(_recip)),
          };

    const payload = msg.payload ? encoding.bytes.encode(msg.payload) : undefined;

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
    if (this._state !== TransferState.Created)
      throw new Error("Invalid state transition in `start`");

    this.transactions = await (this.fromGateway()
      ? this._transferIbc(signer)
      : this._transfer(signer));

    // Update State Machine
    this._state = TransferState.SourceInitiated;
    return this.transactions.map((tx) => tx.txid);
  }

  private async _transfer(signer: Signer): Promise<TransactionId[]> {
    const tokenAddress = this.transfer.token === "native" ? "native" : this.transfer.token.address;

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    // Build the message needed to send a transfer through the gateway
    const tb = await fromChain.getTokenBridge();
    const xfer = tb.transfer(
      this.transfer.from.address,
      this.gatewayAddress,
      tokenAddress,
      this.transfer.amount,
      encoding.bytes.encode(JSON.stringify(this.msg)),
    );

    return signSendWait<N, typeof fromChain.chain>(fromChain, xfer, signer);
  }

  private async _transferIbc(signer: Signer): Promise<TransactionId[]> {
    if (this.transfer.token === "native") throw new Error("Native not supported for IBC transfers");

    const fromChain = this.wh.getChain(this.transfer.from.chain);

    const ibcBridge = await fromChain.getIbcBridge();
    const xfer = ibcBridge.transfer(
      this.transfer.from.address,
      this.transfer.to,
      this.transfer.token.address,
      this.transfer.amount,
    );

    return signSendWait<N, typeof fromChain.chain>(fromChain, xfer, signer);
  }

  // TODO: track the time elapsed and subtract it from the timeout passed with
  // successive updates
  // wait for the Attestations to be ready
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    // Note: this method probably does too much

    if (this._state < TransferState.SourceInitiated || this._state > TransferState.Attested)
      throw new Error("Invalid state transition in `fetchAttestation`");

    const attestations: AttestationId[] = [];

    const chain = this.wh.getChain(this.transfer.from.chain);
    // collect ibc transfers and additional transaction ids
    if (this.fromGateway()) {
      // assume all the txs are from the same chain
      // and get the ibc bridge once
      const originIbcbridge = await chain.getIbcBridge();

      // Ultimately we need to find the corresponding Wormchain transaction
      // from the intitiating cosmos chain, this will contain the details of the
      // outbound transaction to the destination chain

      // start by getting the IBC transfers into wormchain
      // from the cosmos chain
      this.ibcTransfers = (
        await Promise.all(
          this.transactions.map((tx) => originIbcbridge.lookupTransferFromTx(tx.txid)),
        )
      ).flat();

      // I don't know why this would happen so lmk if you see this
      if (this.ibcTransfers.length != 1) throw new Error("why?");

      const [xfer] = this.ibcTransfers;
      if (!this.toGateway()) {
        // If we're leaving cosmos, grab the VAA from the gateway
        // now find the corresponding wormchain transaction given the ibcTransfer info
        const retryInterval = 5000;
        const task = () => this.gatewayIbcBridge.lookupMessageFromIbcMsgId(xfer!.id);
        const whm = await retry<WormholeMessageId>(
          task,
          retryInterval,
          timeout,
          "Gateway:IbcBridge:LookupWormholeMessageFromIncomingIbcMessage",
        );
        if (!whm) throw new Error("Matching wormhole message not found after retries exhausted");

        const vaa = await GatewayTransfer.getTransferVaa(this.wh, whm);
        this.vaas = [{ id: whm, vaa }];

        attestations.push(whm);
      } else {
        // Otherwise we need to get the transfer on the destination chain
        const dstChain = this.wh.getChain(this.transfer.to.chain);
        const dstIbcBridge = await dstChain.getIbcBridge();
        const ibcXfer = await dstIbcBridge.lookupTransferFromIbcMsgId(xfer!.id);
        this.ibcTransfers.push(ibcXfer);
      }
    } else {
      // Otherwise, we're coming from outside cosmos and
      // we need to find the wormchain ibc transaction information
      // by searching for the transaction containing the
      // GatewayTransferMsg
      const transferTransaction = this.transactions[this.transactions.length - 1]!;
      const [whm] = await Wormhole.parseMessageFromTx(chain, transferTransaction.txid);
      const vaa = await GatewayTransfer.getTransferVaa(this.wh, whm!);
      this.vaas = [{ id: whm!, vaa }];

      attestations.push(whm!);

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
      if (!redeemed) throw new Error("VAA not redeemed after retries exhausted");

      // Next, get the IBC transactions from wormchain
      // Note: Because we search by GatewayTransferMsg payload
      // there is a possibility of dupe messages being returned
      // using a nonce should help
      const wcTransferTask = () => fetchIbcXfer(this.gatewayIbcBridge, this.msg);
      const wcTransfer = await retry<IbcTransferInfo>(
        wcTransferTask,
        vaaRedeemedRetryInterval,
        timeout,
        "Gateway:IbcBridge:WormchainTransferInitiated",
      );
      if (!wcTransfer) throw new Error("Wormchain transfer not found after retries exhausted");

      if (wcTransfer.pending) {
        // TODO: check if pending and bail(?) if so
      }

      this.ibcTransfers.push(wcTransfer);

      // Finally, get the IBC transfer to the destination chain
      const destChain = this.wh.getChain(this.transfer.to.chain);
      const destIbcBridge = await destChain.getIbcBridge();
      //@ts-ignore
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

    this._state = TransferState.Attested;

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
    if (this._state < TransferState.Attested)
      throw new Error("Invalid state transition in `finish`. Be sure to call `fetchAttestation`.");

    if (this.toGateway())
      // TODO: assuming the last transaction captured is the one from gateway to the destination
      return [this.transactions[this.transactions.length - 1]!.txid];

    if (!this.vaas) throw new Error("No VAA details available to redeem");
    if (this.vaas.length > 1) throw new Error("Expected 1 vaa");

    const { chain, address } = this.transfer.to;

    const toChain = this.wh.getChain(chain);
    // TODO: these could be different, but when?
    //const signerAddress = toNative(signer.chain(), signer.address());
    const toAddress = address.toUniversalAddress();

    const tb = await toChain.getTokenBridge();

    const { vaa } = this.vaas[0]!;
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0]!.id.sequence}`);

    const xfer = tb.redeem(toAddress, vaa);
    const redeemTxs = await signSendWait<N, typeof toChain.chain>(toChain, xfer, signer);
    this.transactions.push(...redeemTxs);
    this._state = TransferState.DestinationInitiated;
    return redeemTxs.map(({ txid }) => txid);
  }

  static async getTransferVaa<N extends Network>(
    wh: Wormhole<N>,
    whm: WormholeMessageId,
    timeout?: number,
  ): Promise<TokenBridge.TransferVAA> {
    const vaa = await wh.getVaa(whm, TokenBridge.getTransferDiscriminator(), timeout);
    if (!vaa) throw new Error(`No VAA Available: ${whm.chain}/${whm.emitter}/${whm.sequence}`);
    return vaa;
  }

  // Implicitly determine if the chain is Gateway enabled by
  // checking to see if the Gateway IBC bridge has a transfer channel setup
  // If this is a new chain, add the channels to the constants file
  private fromGateway(): boolean {
    return this.gatewayIbcBridge.getTransferChannel(this.transfer.from.chain) !== null;
  }
  private toGateway(): boolean {
    return this.gatewayIbcBridge.getTransferChannel(this.transfer.to.chain) !== null;
  }
}
