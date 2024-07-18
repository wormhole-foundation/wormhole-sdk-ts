import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import {
  amount,
  chainToPlatform,
  contracts,
  encoding,
  toChain,
} from "@wormhole-foundation/sdk-base";
import type {
  Attestation,
  AttestationId,
  ChainAddress,
  ChainContext,
  GatewayTransferDetails,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcMessageId,
  IbcTransferData,
  IbcTransferInfo,
  Signer,
  TokenId,
  TokenTransferDetails,
  TransactionId,
  TxHash,
  WormholeMessageId,
} from "@wormhole-foundation/sdk-definitions";
import {
  TokenBridge,
  UniversalAddress,
  gatewayTransferMsg,
  isGatewayTransferDetails,
  isIbcMessageId,
  isNative,
  isTransactionIdentifier,
  isWormholeMessageId,
  toGatewayMsg,
  toNative,
} from "@wormhole-foundation/sdk-definitions";
import { signSendWait } from "../../common.js";
import { DEFAULT_TASK_TIMEOUT } from "../../config.js";
import { fetchIbcXfer, isTokenBridgeVaaRedeemed, retry } from "../../tasks.js";
import type {
  AttestedTransferReceipt,
  CompletedTransferReceipt,
  RedeemedTransferReceipt,
  SourceFinalizedTransferReceipt,
  TransferQuote,
  TransferReceipt as _TransferReceipt,
} from "../../types.js";
import { TransferState, isAttested, isSourceFinalized, isSourceInitiated } from "../../types.js";
import { Wormhole } from "../../wormhole.js";
import { TokenTransfer } from "../index.js";
import type { WormholeTransfer } from "../wormholeTransfer.js";

export type GatewayContext<N extends Network> = ChainContext<N, typeof GatewayTransfer.chain>;

export class GatewayTransfer<N extends Network = Network> implements WormholeTransfer<"IbcBridge"> {
  static readonly chain: "Wormchain" = "Wormchain";

  private readonly wh: Wormhole<N>;

  // Wormchain context
  private readonly gateway: GatewayContext<N>;

  // state machine tracker
  private _state: TransferState;

  // cached message derived from transfer details
  // note: we don't want to create multiple different ones since
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
  ) {
    this._state = TransferState.Created;
    this.wh = wh;
    this.transfer = transfer;

    // cache the wormchain chain context since we need it for checks
    this.gateway = gateway;

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

    // Fresh new transfer
    if (isGatewayTransferDetails(from)) {
      const fromChain = wh.getChain(from.from.chain);
      const toChain = wh.getChain(from.to.chain);
      const overrides = await GatewayTransfer.destinationOverrides(fromChain, toChain, wc, from);

      // Override transfer params if necessary
      from = { ...from, ...overrides };
      return new GatewayTransfer(wh, from, wc);
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

    const gt = new GatewayTransfer(wh, gtd, wc);
    gt.transactions = txns;

    // Since we're picking up from somewhere we can move the
    // state machine to initiated
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
    // and since we use the payload to find the Wormchain transaction
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
        /*Ignoring, throws if not the payload isn't JSON*/
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

    // If its origin chain supports IBC, it should be an IBC message
    if (originChain.supportsIbcBridge()) {
      // Get the ibc tx info from the origin
      const ibcBridge = await originChain.getIbcBridge();
      const [xfer] = await ibcBridge.lookupTransferFromTx(from.txid);
      return GatewayTransfer.ibcTransfertoGatewayTransfer(xfer!);
    }

    // Otherwise grab the vaa details from the origin tx
    const msgs = await Wormhole.parseMessageFromTx(originChain, txid);
    if (!msgs) throw new Error("No messages found in transaction");
    return await GatewayTransfer._fromMsgId(wh, msgs[0]!, timeout);
  }

  // Recover transfer info the first step in the transfer
  private static ibcTransfertoGatewayTransfer(xfer: IbcTransferInfo): GatewayTransferDetails {
    const token = Wormhole.tokenId(xfer.id.chain, xfer.data.denom);

    const msg = toGatewayMsg(xfer.data.memo);
    const destChain = toChain(msg.chain);
    const _recip = encoding.b64.decode(msg.recipient);

    const recipient: ChainAddress =
      chainToPlatform(destChain) === "Cosmwasm"
        ? Wormhole.chainAddress(destChain, encoding.bytes.decode(_recip))
        : {
            chain: destChain,
            address: new UniversalAddress(_recip).toNative(destChain),
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
    if (this._state !== TransferState.Created)
      throw new Error("Invalid state transition in `start`");

    this.transactions = await GatewayTransfer.transfer(
      this.wh,
      this.wh.getChain(this.transfer.from.chain),
      this.transfer,
      signer,
      this.msg,
    );

    // Update State Machine
    this._state = TransferState.SourceInitiated;
    return this.transactions.map((tx) => tx.txid);
  }

  // wait for the Attestations to be ready
  async fetchAttestation(timeout?: number): Promise<AttestationId[]> {
    if (this._state < TransferState.SourceInitiated || this._state > TransferState.Attested)
      throw new Error("Invalid state transition in `fetchAttestation`");

    const attestations: AttestationId[] = [];

    const chain = this.wh.getChain(this.transfer.from.chain);
    // collect ibc transfers and additional transaction ids
    const fromGateway = await GatewayTransfer.isGatewayEnabled(
      this.transfer.from.chain,
      this.gateway,
    );

    if (fromGateway) {
      // assume all the txs are from the same chain
      // and get the ibc bridge once

      // Ultimately we need to find the corresponding Wormchain transaction
      // from the intitiating cosmos chain, this will contain the details of the
      // outbound transaction to the destination chain

      // start by getting the IBC transfers into wormchain
      // from the cosmos chain
      const outboundXfer = await GatewayTransfer.getIbcTransfer(chain, this.transactions);
      this.ibcTransfers = [outboundXfer];

      const toGateway = await GatewayTransfer.isGatewayEnabled(
        this.transfer.to.chain,
        this.gateway,
      );
      if (!toGateway) {
        // If we're leaving cosmos, grab the VAA from the gateway
        // now find the corresponding wormchain transaction given the ibcTransfer info
        const vaa = await GatewayTransfer.getTransferVaa(this.wh, outboundXfer!.id, timeout);
        const id = { emitter: vaa.emitterAddress, chain: vaa.emitterChain, sequence: vaa.sequence };
        this.vaas = [{ id, vaa }];
        attestations.push(id);
      } else {
        // First, find the ibc transfer into gateway using the origin chains ibc transfer info
        const fromGatewayIbcTransfer = await GatewayTransfer.getIbcInfo(this.gateway, outboundXfer);
        this.ibcTransfers.push(fromGatewayIbcTransfer);

        // Then, find the corresponding redeem on the final destination chain using the gateway ibc transfer info
        const dstChain = this.wh.getChain(this.transfer.to.chain);
        const dstIbcTransfer = await GatewayTransfer.getIbcInfo(dstChain, fromGatewayIbcTransfer);
        this.ibcTransfers.push(dstIbcTransfer);
      }
    } else {
      // Otherwise, we're coming from outside cosmos and
      // we need to find the wormchain ibc transaction information
      // by searching for the transaction containing the
      // GatewayTransferMsg
      const transferTransaction = this.transactions[this.transactions.length - 1]!;
      const whm = await GatewayTransfer.getTransferMessage(
        this.wh,
        chain,
        transferTransaction.txid,
      );
      if (isIbcMessageId(whm)) throw new Error("Expected WormholeMessageId");

      const vaa = await GatewayTransfer.getTransferVaa(this.wh, whm!);
      if (vaa.payloadName !== "TransferWithPayload")
        throw new Error("Expected TransferWithPayload VAA");

      this.vaas = [{ id: whm!, vaa }];

      attestations.push(whm!);

      const wcTransfer = await GatewayTransfer.getExternalGatewayRedeem(this.wh, vaa, timeout);
      this.ibcTransfers.push(wcTransfer!);

      // Finally, get the IBC transfer to the destination chain
      const destChain = this.wh.getChain(this.transfer.to.chain);
      const destTransfer = await GatewayTransfer.getIbcInfo(destChain, wcTransfer!);
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
    if (this._state < TransferState.Attested)
      throw new Error("Invalid state transition in `finish`. Be sure to call `fetchAttestation`.");

    const toGateway = await GatewayTransfer.isGatewayEnabled(this.transfer.to.chain, this.gateway);
    if (toGateway) {
      // TODO: assuming the last transaction captured is the one from gateway to the destination
      return [this.transactions[this.transactions.length - 1]!.txid];
    }

    if (!this.vaas) throw new Error("No VAA details available to redeem");
    if (this.vaas.length > 1) throw new Error("Expected 1 vaa");

    const toChain = this.wh.getChain(signer.chain());
    const toAddress = toNative(signer.chain(), signer.address());

    const tb = await toChain.getTokenBridge();

    const { vaa } = this.vaas[0]!;
    if (!vaa) throw new Error(`No VAA found for ${this.vaas[0]!.id.sequence}`);

    const xfer = tb.redeem(toAddress, vaa);
    const redeemTxs = await signSendWait<N, typeof toChain.chain>(toChain, xfer, signer);
    this.transactions.push(...redeemTxs);
    this._state = TransferState.DestinationInitiated;
    return redeemTxs.map(({ txid }) => txid);
  }
}

export namespace GatewayTransfer {
  export type Protocol = "TokenBridge" | "IbcBridge";

  export type AttestationReceipt<PN extends Protocol = GatewayTransfer.Protocol> = {
    id: AttestationId<PN>;
    attestation?: Attestation<PN>;
  };

  export type TransferReceipt<
    SC extends Chain = Chain,
    DC extends Chain = Chain,
  > = _TransferReceipt<GatewayTransfer.AttestationReceipt, SC, DC>;

  // Implicitly determine if the chain is Gateway enabled by
  // checking to see if the Gateway IBC bridge has a transfer channel setup
  // If this is a new chain, add the channels to the constants file
  export async function isGatewayEnabled<N extends Network>(
    chain: Chain,
    gateway: GatewayContext<N>,
  ): Promise<boolean> {
    const ibcBridge = await gateway.getIbcBridge();
    return ibcBridge.getTransferChannel(chain) !== null;
  }

  // Get the signed Token Transfer VAA emitted either by the Gateway or the !Cosmos chain
  export async function getTransferVaa<N extends Network>(
    wh: Wormhole<N>,
    whm: WormholeMessageId | IbcMessageId,
    timeout?: number,
  ): Promise<TokenBridge.TransferVAA> {
    if (isIbcMessageId(whm)) {
      const gateway = wh.getChain(GatewayTransfer.chain);
      const gatewayIbcBridge = await gateway.getIbcBridge();
      // If we're leaving cosmos, grab the VAA from the gateway
      // now find the corresponding wormchain transaction given the ibcTransfer info
      const retryInterval = 5000;
      const task = () => gatewayIbcBridge.lookupMessageFromIbcMsgId(whm as IbcMessageId);
      const wormholeMessage = await retry<WormholeMessageId>(
        task,
        retryInterval,
        timeout,
        "Gateway:IbcBridge:LookupWormholeMessageFromIncomingIbcMessage",
      );
      if (!wormholeMessage)
        throw new Error("Matching wormhole message not found after retries exhausted");

      whm = wormholeMessage;
    }

    const vaa = await wh.getVaa(whm, TokenBridge.getTransferDiscriminator(), timeout);
    if (!vaa) throw new Error(`No VAA Available: ${whm.chain}/${whm.emitter}/${whm.sequence}`);
    return vaa;
  }

  // This will return the message id for the transfer
  // It will be an IBC message id if the origin chain supports IBC
  // Otherwise it will be a WormholeMessageId
  export async function getTransferMessage<N extends Network, C extends Chain>(
    wh: Wormhole<N>,
    fromChain: ChainContext<N, C>,
    txid: TxHash,
  ): Promise<WormholeMessageId | IbcMessageId> {
    const fromCosmos = await GatewayTransfer.isGatewayEnabled(
      fromChain.chain,
      wh.getChain(GatewayTransfer.chain),
    );
    if (fromCosmos) {
      // Get the ibc tx info from the origin
      const ibcBridge = await fromChain.getIbcBridge();
      const [xfer] = await ibcBridge.lookupTransferFromTx(txid);
      if (!xfer) throw new Error("No IBC transfer found in transaction");
      return xfer.id;
    }

    // Otherwise grab the vaa details from the origin tx
    const [msg] = await Wormhole.parseMessageFromTx(fromChain, txid);
    if (!msg) throw new Error("No messages found in transaction");
    return msg;
  }

  export async function getAttestation<N extends Network>(
    wh: Wormhole<N>,
    fromChain: ChainContext<N, Chain>,
    toChain: ChainContext<N, Chain>,
    id: WormholeMessageId | IbcMessageId,
    timeout?: number,
  ): Promise<TokenBridge.TransferVAA | IbcTransferData> {
    if (isWormholeMessageId(id)) {
      // transferring into cosmos
      return await GatewayTransfer.getTransferVaa(wh, id);
    }

    const gw = wh.getChain(GatewayTransfer.chain);
    const toCosmos = await GatewayTransfer.isGatewayEnabled(toChain.chain, gw);
    if (toCosmos) {
      // transferring between cosmos
      const ibc = await fromChain.getIbcBridge();
      const xfers = await fetchIbcXfer(ibc, id);
      if (!xfers || xfers.length === 0) throw new Error("No IBC transfer found");
      // TODO: why 1?
      // IBC message leaving wormchain
      return xfers[1]!.data;
    }
    // transferring out of cosmos
    // If we're leaving cosmos, grab the VAA from the gateway
    // now find the corresponding wormchain transaction given the ibcTransfer info
    const retryInterval = 5000;
    const gwIbc = await gw.getIbcBridge();
    const task = () => gwIbc.lookupMessageFromIbcMsgId(id);
    const whm = await retry<WormholeMessageId>(
      task,
      retryInterval,
      timeout,
      "Gateway:IbcBridge:LookupWormholeMessageFromIncomingIbcMessage",
    );
    if (!whm) throw new Error("Matching wormhole message not found after retries exhausted");
    return await GatewayTransfer.getTransferVaa(wh, whm);
  }

  export async function getIbcInfo<N extends Network, C extends Chain>(
    dstChain: ChainContext<N, C>,
    gatewayTransfer: IbcTransferInfo,
    timeout?: number,
  ) {
    // Finally, get the IBC transfer to the destination chain
    const destIbcBridge = await dstChain.getIbcBridge();

    const destTransferTask = () => fetchIbcXfer(destIbcBridge, gatewayTransfer.id);
    const destTransfer = await retry<IbcTransferInfo[]>(
      destTransferTask,
      5000,
      timeout,
      "Destination:IbcBridge:WormchainTransferCompleted",
    );

    if (!destTransfer)
      throw new Error(
        "IBC Transfer into destination not found after retries exhausted" +
          JSON.stringify(gatewayTransfer),
      );

    return destTransfer[0]!;
  }

  export async function getExternalGatewayRedeem(
    wh: Wormhole<Network>,
    vaa: TokenBridge.VAA<"TransferWithPayload">,
    timeout: number = DEFAULT_TASK_TIMEOUT,
  ) {
    const vaaRedeemedRetryInterval = 2000;
    const gateway = wh.getChain(GatewayTransfer.chain);
    // Wait until the vaa is redeemed before trying to look up the
    // transfer message
    const wcTb = await gateway.getTokenBridge();

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

    const msg = encoding.bytes.decode(vaa.payload.payload);
    console.log(msg);

    // Next, get the IBC transactions from wormchain
    // Note: Because we search by GatewayTransferMsg payload
    // there is a possibility of dupe messages being returned
    // using a nonce should help
    const gatewayIbcBridge = await gateway.getIbcBridge();
    const wcTransferTask = () => fetchIbcXfer(gatewayIbcBridge, JSON.parse(msg));
    const wcTransfers = await retry<IbcTransferInfo[]>(
      wcTransferTask,
      vaaRedeemedRetryInterval,
      timeout,
      "Gateway:IbcBridge:WormchainTransferInitiated",
    );
    if (!wcTransfers) throw new Error("Wormchain transfer not found after retries exhausted");
    const [wcTransfer] = wcTransfers;
    if (wcTransfer!.pending) {
      // TODO: check if pending and bail(?) if so
    }

    return wcTransfer;
  }

  export async function getIbcTransfer(
    chain: ChainContext<Network, Chain>,
    txids: TransactionId[],
  ) {
    //
    const originIbcbridge = await chain.getIbcBridge();

    const transfers = (
      await Promise.all(txids.map((tx) => originIbcbridge.lookupTransferFromTx(tx.txid)))
    ).flat();

    // I don't know why this would happen so lmk if you see this
    if (transfers.length != 1) throw new Error("why?");
    return transfers[0]!;
  }

  export async function destinationOverrides<N extends Network>(
    srcChain: ChainContext<N>,
    dstChain: ChainContext<N>,
    gatewayChain: ChainContext<N, "Wormchain">,
    transfer: GatewayTransferDetails,
  ): Promise<GatewayTransferDetails> {
    const _transfer = { ...transfer };

    // Bit of (temporary) hackery until solana contracts support being
    // sent a VAA with the primary address
    if (transfer.to.chain === "Solana") {
      const destinationToken = await GatewayTransfer.lookupDestinationToken(
        srcChain,
        dstChain,
        gatewayChain,
        _transfer.token,
      );

      _transfer.to = await dstChain.getTokenAccount(_transfer.to.address, destinationToken.address);
    }

    return _transfer;
  }

  // Lookup the token id for the destination chain or gateway given the source chain
  // and token id
  export async function lookupDestinationToken<
    N extends Network,
    SC extends Chain,
    DC extends Chain,
  >(
    srcChain: ChainContext<N, SC>,
    dstChain: ChainContext<N, DC>,
    gateway: GatewayContext<N>,
    token: TokenId<SC>,
  ): Promise<TokenId<DC> | TokenId<"Wormchain">> {
    const [fromGateway, toGateway] = await Promise.all([
      GatewayTransfer.isGatewayEnabled(srcChain.chain, gateway),
      GatewayTransfer.isGatewayEnabled(dstChain.chain, gateway),
    ]);

    if (fromGateway && isNative(token)) {
      throw new Error("Native transfer from Cosmos not supported");
    }

    const lookup: TokenId<"Wormchain"> = await (async function () {
      // Find the cw20 token on gateway, always
      if (fromGateway) {
        // we're coming from a gateway enabled chain
        // find the cw20 address on the gateway
        // given the ibc address from the source
        const srcIbcBridge = await srcChain.getIbcBridge();
        const address = await srcIbcBridge.getGatewayAsset(token.address);
        return { chain: GatewayTransfer.chain, address };
      } else {
        return await TokenTransfer.lookupDestinationToken(srcChain, gateway, token);
      }
    })();

    if (toGateway) return lookup;
    return await TokenTransfer.lookupDestinationToken(gateway, dstChain, lookup);
  }

  export async function transfer<N extends Network>(
    wh: Wormhole<N>,
    fromChain: ChainContext<N, Chain>,
    transfer: GatewayTransferDetails,
    signer: Signer<N, Chain>,
    msg?: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
  ): Promise<TransactionId[]> {
    const fromCosmos = await GatewayTransfer.isGatewayEnabled(
      fromChain.chain,
      wh.getChain(GatewayTransfer.chain),
    );
    if (fromCosmos) {
      return await transferFromCosmos(fromChain, transfer, signer);
    }
    return await transferToCosmos(wh, fromChain, transfer, signer, msg);
  }

  export async function transferToCosmos<N extends Network>(
    wh: Wormhole<N>,
    fromChain: ChainContext<N, Chain>,
    transfer: GatewayTransferDetails,
    signer: Signer<N, Chain>,
    msg?: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
  ): Promise<TransactionId[]> {
    const tb = await fromChain.getTokenBridge();
    const gateway = await wh.getChain(GatewayTransfer.chain);
    const gatewayAddress: ChainAddress = {
      chain: gateway.chain,
      address: toNative(gateway.chain, gateway.config.contracts.gateway!),
    };
    msg = msg ?? gatewayTransferMsg(transfer);
    const xfer = tb.transfer(
      transfer.from.address,
      gatewayAddress,
      transfer.token.address,
      transfer.amount,
      encoding.bytes.encode(JSON.stringify(msg)),
    );
    return await signSendWait(fromChain, xfer, signer);
  }

  export async function transferFromCosmos<N extends Network>(
    fromChain: ChainContext<N, Chain>, // TODO: CosmwasmChain?
    transfer: GatewayTransferDetails,
    signer: Signer<N, Chain>,
  ): Promise<TransactionId[]> {
    if (isNative(transfer.token.address)) throw new Error("Native not supported for IBC transfers");
    const ibcBridge = await fromChain.getIbcBridge();
    const xfer = ibcBridge.transfer(
      transfer.from.address,
      transfer.to,
      transfer.token.address,
      transfer.amount,
    );
    return signSendWait<N, typeof fromChain.chain>(fromChain, xfer, signer);
  }

  // AsyncGenerator fn that produces status updates through an async generator
  // eventually producing a receipt
  // can be called repeatedly so the receipt is updated as it moves through the
  // steps of the transfer
  export async function* track<N extends Network, SC extends Chain, DC extends Chain>(
    wh: Wormhole<N>,
    receipt: GatewayTransfer.TransferReceipt<SC, DC>,
    timeout: number = DEFAULT_TASK_TIMEOUT,
    srcChain?: ChainContext<N, SC>,
    dstChain?: ChainContext<N, DC>,
  ): AsyncGenerator<GatewayTransfer.TransferReceipt<SC, DC>> {
    // const start = Date.now();
    // const leftover = (start: number, max: number) => Math.max(max - (Date.now() - start), 0);

    srcChain = srcChain ?? wh.getChain(receipt.from);
    dstChain = dstChain ?? wh.getChain(receipt.to);

    // Check the source chain for initiation transaction
    // and capture the message id
    if (isSourceInitiated(receipt)) {
      if (receipt.originTxs.length === 0) throw "Origin transactions required to fetch message id";
      const { txid } = receipt.originTxs[receipt.originTxs.length - 1]!;
      const msg = await GatewayTransfer.getTransferMessage(wh, srcChain, txid);
      receipt = {
        ...receipt,
        state: TransferState.SourceFinalized,
        attestation: { id: msg },
      } satisfies SourceFinalizedTransferReceipt<GatewayTransfer.AttestationReceipt>;
      yield receipt;
    }

    if (isSourceFinalized(receipt)) {
      if (!receipt.attestation.id) throw "Attestation id required to fetch attestation";
      const { id } = receipt.attestation;
      const attestation = await GatewayTransfer.getAttestation(wh, srcChain, dstChain, id);
      if (!attestation) throw new Error("Attestation not found");
      receipt = {
        ...receipt,
        attestation: { id, attestation },
        state: TransferState.Attested,
      } satisfies AttestedTransferReceipt<GatewayTransfer.AttestationReceipt>;
      yield receipt;
    }

    if (isAttested(receipt)) {
      // Coming from IBC, we need to check the status of the IBC transfer
      // Currently using the whscan API but could use gateway to see if the ibc message
      // has been redeemed (and a VAA emitted if we're leaving cosmos)
      if (isIbcMessageId(receipt.attestation.id)) {
        // If the attestation is IBC, we have to use the
        const txStatus = await wh.getTransactionStatus(receipt.originTxs[0]!.txid, timeout);
        if (txStatus && txStatus.globalTx?.destinationTx?.txHash) {
          const { chainId, txHash } = txStatus.globalTx.destinationTx;
          receipt = {
            ...receipt,
            destinationTxs: [{ chain: toChain(chainId) as DC, txid: txHash }],
            state: TransferState.DestinationInitiated,
          } satisfies RedeemedTransferReceipt<GatewayTransfer.AttestationReceipt>;
          yield receipt;
        }
      } else {
        const { attestation } =
          receipt.attestation as GatewayTransfer.AttestationReceipt<"TokenBridge">;

        if (attestation!.payloadName !== "TransferWithPayload")
          throw new Error("Invalid attestation protocol");

        // If the attestation is a WormholeMessageId, we need to check the status of the VAA
        const gatewayRedeemData = await GatewayTransfer.getExternalGatewayRedeem(
          wh,
          attestation!,
          timeout,
        );
        receipt = {
          ...receipt,
          attestation: { id: gatewayRedeemData!.id, attestation: gatewayRedeemData!.data },
          state: TransferState.DestinationInitiated,
        } satisfies RedeemedTransferReceipt<GatewayTransfer.AttestationReceipt>;
        yield receipt;

        const dstRedeemData = await GatewayTransfer.getIbcInfo(
          dstChain,
          gatewayRedeemData!,
          timeout,
        );

        receipt = {
          ...receipt,
          attestation: { id: dstRedeemData!.id, attestation: dstRedeemData!.data },
          state: TransferState.DestinationFinalized,
        } satisfies CompletedTransferReceipt<GatewayTransfer.AttestationReceipt>;
        yield receipt;
      }
    }

    yield receipt;
  }

  export async function quoteTransfer<N extends Network>(
    wh: Wormhole<N>,
    srcChain: ChainContext<N, Chain>,
    dstChain: ChainContext<N, Chain>,
    transfer: Omit<TokenTransferDetails, "from" | "to">,
  ): Promise<TransferQuote> {
    const fromGateway = await GatewayTransfer.isGatewayEnabled(
      srcChain.chain,
      wh.getChain(GatewayTransfer.chain),
    );
    if (fromGateway && isNative(transfer.token.address)) {
      throw new Error("Native token transfer from Cosmos not supported");
    }
    const srcDecimals = await srcChain.getDecimals(transfer.token.address);
    const srcAmount = amount.fromBaseUnits(transfer.amount, srcDecimals);
    const srcAmountTruncated = amount.truncate(srcAmount, TokenTransfer.MAX_DECIMALS);

    const srcToken = isNative(transfer.token.address)
      ? await srcChain.getNativeWrappedTokenId()
      : transfer.token;

    // TODO: check governor limits

    const dstToken = await GatewayTransfer.lookupDestinationToken(
      srcChain,
      dstChain,
      wh.getChain(GatewayTransfer.chain),
      transfer.token,
    );
    const dstDecimals = await dstChain.getDecimals(dstToken.address);
    const dstAmountReceivable = amount.scale(srcAmountTruncated, dstDecimals);

    return {
      sourceToken: { token: srcToken, amount: amount.units(srcAmountTruncated) },
      destinationToken: { token: dstToken, amount: amount.units(dstAmountReceivable) },
    };
  }

  export function supportedChains(network: Network): Chain[] {
    const supported = new Set<Chain>();
    // Chains with token bridge are supported
    contracts.tokenBridgeChains(network).forEach((chain) => supported.add(chain));
    // Chains connected to Gateway via IBC are supported
    //Object.entries(networkChainToChannels(network, GatewayTransfer.chain)).forEach(
    //  ([chainName]) => {
    //    if (isChain(chainName)) {
    //      supported.add(chainName);
    //    }
    //  },
    //);
    return [...supported];
  }

  export async function supportedSourceTokens(
    fromChain: ChainContext<Network>,
  ): Promise<TokenId[]> {
    let isGatewayEnabled = false;
    if (chainToPlatform(fromChain.chain) === "Cosmwasm") {
      const gateway = await fromChain.platform.getChain(GatewayTransfer.chain);
      isGatewayEnabled = await GatewayTransfer.isGatewayEnabled(fromChain.chain, gateway);
    }
    return (
      Object.values(fromChain.config.tokenMap!)
        .map((td) => Wormhole.tokenId(td.chain, td.address))
        // Native token transfer from Cosmos not supported
        .filter((t) => !isGatewayEnabled || !isNative(t.address))
    );
  }

  export async function supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const gateway = (
      chainToPlatform(fromChain.chain) === "Cosmwasm" ? fromChain.platform : toChain.platform
    ).getChain(GatewayTransfer.chain);
    try {
      return [
        await GatewayTransfer.lookupDestinationToken(fromChain, toChain, gateway, sourceToken),
      ];
    } catch (e) {
      console.error(`Failed to get destination token: ${e}`);
      return [];
    }
  }

  export function isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsTokenBridge() || chain.supportsIbcBridge();
  }
}
