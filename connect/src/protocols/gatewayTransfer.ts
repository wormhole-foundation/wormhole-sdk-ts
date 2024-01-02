import {
  Network,
  PlatformToChains,
  chainToPlatform,
  encoding,
  toChain,
} from "@wormhole-foundation/sdk-base";
import {
  AttestationId,
  AttestationReceipt,
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
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../common";
import { fetchIbcXfer, isTokenBridgeVaaRedeemed, retry } from "../tasks";
import { Wormhole } from "../wormhole";
import { TransferReceipt, TransferState, WormholeTransfer } from "../wormholeTransfer";

type GatewayContext<N extends Network> = ChainContext<N, "Cosmwasm", typeof GatewayTransfer.chain>;
type GatewayIbcBridge<N extends Network> = IbcBridge<N, "Cosmwasm", typeof GatewayTransfer.chain>;

type GatewayTransferProtocols = "IbcBridge" | "TokenBridge";

export class GatewayTransfer<N extends Network = Network>
  implements WormholeTransfer<GatewayTransferProtocols>
{
  static chain: "Wormchain" = "Wormchain";

  private readonly wh: Wormhole<N>;

  // state machine tracker
  private _state: TransferState;

  // Wormchain context
  private readonly gateway: GatewayContext<N>;
  // Wormchain IBC Bridge
  private readonly gatewayIbcBridge: GatewayIbcBridge<N>;
  // Contract address
  private readonly gatewayAddress: ChainAddress;

  // cached message derived from transfer details
  // note: we dont want to create multiple different ones since
  // the nonce may change and we want to keep it consistent
  private msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg;

  // Initial Transfer Settings
  transfer: GatewayTransferDetails;

  // Transaction Ids from source chain
  txids: TransactionId[] = [];

  // The corresponding vaa representing the GatewayTransfer
  // on the source chain (if it came from outside cosmos and if its been completed and finalized)
  attestations?: AttestationReceipt<GatewayTransferProtocols>[];

  // Any transfers we do over ibc
  //ibcTransfers: IbcTransferInfo[] = [];

  private constructor(
    wh: Wormhole<N>,
    transfer: GatewayTransferDetails,
    gateway: GatewayContext<N>,
    gatewayIbc: IbcBridge<N, "Cosmwasm", typeof GatewayTransfer.chain>,
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
      gtd = await GatewayTransfer._fromTransaction(wh, from, wcibc);
    } else if (isWormholeMessageId(from)) {
      // TODO: we're missing the transaction that created this
      // get it from transaction status search on wormholescan?
      gtd = await GatewayTransfer._fromMsgId(wh, from);
    } else {
      throw new Error("Invalid `from` parameter for GatewayTransfer");
    }

    const gt = new GatewayTransfer(wh, gtd, wc, wcibc);
    gt.txids = txns;

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
      payload,
    };

    return details;
  }

  // Init from source tx hash, depending on the source chain
  // we pull Transfer info from either IBC or a wh message
  private static async _fromTransaction<N extends Network>(
    wh: Wormhole<N>,
    from: TransactionId,
    wcIbc: IbcBridge<N, "Cosmwasm", typeof GatewayTransfer.chain>,
    timeout?: number,
  ): Promise<GatewayTransferDetails> {
    const { chain, txid } = from;

    const originChain = wh.getChain(chain);

    // If its origin chain is Cosmos, it should be an IBC message
    // but its not all the time so do this differently?
    // TODO: check if the chain supports Gateway protocol?
    if (wcIbc.getTransferChannel(chain) !== null) {
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

    this.txids = await (this.fromGateway() ? this._transferIbc(signer) : this._transfer(signer));

    // Update State Machine
    this._state = TransferState.SourceInitiated;
    return this.txids.map((tx) => tx.txid);
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

  // wait for the Attestations to be ready
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    // Note: this method probably does too much

    if (this._state < TransferState.SourceInitiated || this._state > TransferState.Attested)
      throw new Error("Invalid state transition in `fetchAttestation`");

    if (!this.attestations) this.attestations = [];

    const chain = this.wh.getChain(this.transfer.from.chain);

    // collect ibc transfers and additional transaction ids
    if (this.fromGateway()) {
      const originIbcbridge = await chain.getIbcBridge();

      // Ultimately we need to find the corresponding Wormchain transaction
      // from the intitiating cosmos chain, this will contain the details of the
      // outbound transaction to the destination chain

      // start by getting the IBC transfers into wormchain
      // from the cosmos chain using the originating txids
      const ibcTransfers = (
        await Promise.all(this.txids.map((tx) => originIbcbridge.lookupTransferFromTx(tx.txid)))
      ).flat();
      this.attestations.push(...ibcTransfers);

      const [xfer] = ibcTransfers;
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
        this.attestations.push({ id: whm, attestation: vaa });
      } else {
        // Otherwise we need to get the transfer on the destination chain
        const dstChain = this.wh.getChain(this.transfer.to.chain);
        const dstIbcBridge = await dstChain.getIbcBridge();
        const ibcXfer = await dstIbcBridge.lookupTransferFromIbcMsgId(xfer!.id);
        this.attestations.push(ibcXfer);
      }
    } else {
      // Otherwise, we're coming from outside cosmos and
      // we need to find the wormchain ibc transaction information
      // by searching for the transaction containing the
      // GatewayTransferMsg
      const transferTransaction = this.txids[this.txids.length - 1]!;
      const [whm] = await Wormhole.parseMessageFromTx(chain, transferTransaction.txid);
      const vaa = await GatewayTransfer.getTransferVaa(this.wh, whm!);
      this.attestations.push({ id: whm!, attestation: vaa });

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
      if (wcTransfer.pending) throw new Error("IBC Transfer to destination has not been completed");

      this.attestations.push(wcTransfer);

      // Finally, get the IBC transfer to the destination chain
      const destChain = this.wh.getChain(this.transfer.to.chain);
      const destIbcBridge = await destChain.getIbcBridge();

      const destTransferTask = () =>
        fetchIbcXfer(
          destIbcBridge as IbcBridge<N, "Cosmwasm", PlatformToChains<"Cosmwasm">>,
          wcTransfer.id,
        );
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

      this.attestations.push(destTransfer);
    }

    this._state = TransferState.Attested;
    return this.attestations.map((xfer) => xfer.id);
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
      return [this.txids[this.txids.length - 1]!.txid];

    const { chain, address } = this.transfer.to;

    const toChain = this.wh.getChain(chain);
    const tb = await toChain.getTokenBridge();

    const toAddress = address.toUniversalAddress();

    const { attestation } = this.attestations.filter((a) => isWormholeMessageId(a.id))[0]!;
    if (!attestation) throw new Error(`No VAA found for ${this.attestations[0]!.id.sequence}`);

    const xfer = tb.redeem(toAddress, attestation as TokenBridge.TransferVAA);
    const redeemTxs = await signSendWait<N, typeof toChain.chain>(toChain, xfer, signer);
    this.txids.push(...redeemTxs);
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

  static getReceipt<N extends Network>(
    xfer: GatewayTransfer<N>,
  ): TransferReceipt<GatewayTransferProtocols> {
    const { transfer } = xfer;

    const protocol = xfer.fromGateway() ? "IbcBridge" : "TokenBridge";
    const from = transfer.from.chain;
    const to = transfer.to.chain;

    let receipt: Partial<TransferReceipt<GatewayTransferProtocols>> = {
      protocol,
      request: transfer,
      from: from,
      to: to,
      state: TransferState.Created,
    };

    const originTxs = xfer.txids.filter((txid) => txid.chain === transfer.from.chain);
    if (originTxs.length > 0) {
      receipt = { ...receipt, state: TransferState.SourceInitiated, originTxs: originTxs };
    }

    const whAtt = xfer.attestations.filter((a) => isWormholeMessageId(a.id));
    const attestation = whAtt.length > 0 ? whAtt[0] : undefined;
    if (attestation && attestation.attestation) {
      receipt = {
        ...receipt,
        state: TransferState.Attested,
        attestation: attestation,
      };
    }

    const destinationTxs = xfer.txids.filter((txid) => txid.chain === transfer.to.chain);
    if (destinationTxs.length > 0) {
      receipt = {
        ...receipt,
        state: TransferState.DestinationInitiated,
        destinationTxs: destinationTxs,
      };
    }

    return receipt as TransferReceipt<GatewayTransferProtocols>;
  }

  // // Track the state of a transfer over time given its receipt.
  // // A copy of the receipt will be returned for every state change we look for
  // // It is safe to call this multiple times at the expense possibly redundant RPC calls
  // static async *track<N extends Network, SC extends Chain, DC extends Chain>(
  //   wh: Wormhole<N>,
  //   receipt: TransferReceipt<GatewayTransferProtocols, SC, DC>,
  //   timeout: number = DEFAULT_TASK_TIMEOUT,
  //   // Optional parameters to override chain context (typically for custom rpc)
  //   _fromChain?: ChainContext<N, ChainToPlatform<SC>, SC>,
  //   _toChain?: ChainContext<N, ChainToPlatform<DC>, DC>,
  // ) {
  //   const start = Date.now();
  //   const leftover = (start: number, max: number) => Math.max(max - (Date.now() - start), 0);

  //   _fromChain = _fromChain ?? wh.getChain(receipt.from);
  //   _toChain = _toChain ?? wh.getChain(receipt.to);

  //   // Check the source chain for initiation transaction
  //   // and capture the message id
  //   if (hasReachedState(receipt, TransferState.SourceInitiated)) {
  //     if (receipt.originTxs.length === 0) throw "Origin transactions required to fetch message id";
  //     const { txid } = receipt.originTxs[receipt.originTxs.length - 1]!;
  //     const msg = await GatewayTransfer.get(_fromChain, txid, leftover(start, timeout));
  //     receipt = { ...receipt, state: TransferState.SourceFinalized, attestation: { id: msg } };
  //     yield receipt;
  //   }

  //   // If the source is finalized, we need to fetch the signed attestation
  //   // so that we may deliver it to the destination chain
  //   // or at least track the transfer through its progress
  //   if (hasReachedState(receipt, TransferState.SourceFinalized)) {
  //     if (!receipt.attestation.id) throw "Attestation id required to fetch attestation";
  //     const { id } = receipt.attestation;
  //     const attestation = await GatewayTransfer.getTransferVaa(wh, id, leftover(start, timeout));
  //     receipt = { ...receipt, attestation: { id, attestation }, state: TransferState.Attested };
  //     yield receipt;
  //   }

  //   // First try to grab the tx status from the API
  //   // Note: this requires a subsequent async step on the backend
  //   // to have the dest txid populated, so it may be delayed by some time
  //   if (
  //     hasReachedState(receipt, TransferState.Attested) ||
  //     hasReachedState(receipt, TransferState.SourceFinalized)
  //   ) {
  //     if (!receipt.attestation.id) throw "Attestation id required to fetch redeem tx";
  //     const { id } = receipt.attestation;
  //     const txStatus = await wh.getTransactionStatus(id, leftover(start, timeout));
  //     if (txStatus && txStatus.globalTx?.destinationTx?.txHash) {
  //       const { chainId, txHash } = txStatus.globalTx.destinationTx;
  //       receipt = {
  //         ...receipt,
  //         destinationTxs: [{ chain: toChain(chainId) as DC, txid: txHash }],
  //         state: TransferState.DestinationFinalized,
  //       };
  //     }
  //     yield receipt;
  //   }

  //   // Fall back to asking the destination chain if this VAA has been redeemed
  //   // Note: We do not get any destinationTxs with this method
  //   if (hasReachedState(receipt, TransferState.Attested)) {
  //     if (!receipt.attestation.attestation) throw "Signed Attestation required to check for redeem";
  //     receipt = {
  //       ...receipt,
  //       state: (await GatewayTransfer.isTransferComplete(
  //         _toChain,
  //         receipt.attestation.attestation as TokenBridge.TransferVAA,
  //       ))
  //         ? TransferState.DestinationFinalized
  //         : TransferState.Attested,
  //     };
  //     yield receipt;
  //   }

  //   yield receipt;
  // }

  // Implicitly determine if the chain is Gateway enabled by
  // checking to see if the Gateway IBC bridge has a transfer channel setup
  // If this is a new chain, add the channels to the constants file
  fromGateway(): boolean {
    return this.gatewayIbcBridge.getTransferChannel(this.transfer.from.chain) !== null;
  }
  toGateway(): boolean {
    return this.gatewayIbcBridge.getTransferChannel(this.transfer.to.chain) !== null;
  }
}
