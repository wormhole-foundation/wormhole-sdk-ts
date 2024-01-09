import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { IndexedTx, MsgTransferEncodeObject, coin } from "@cosmjs/stargate";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";

import {
  ChainAddress,
  ChainsConfig,
  Contracts,
  GatewayIbcTransferMsg,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcBridge,
  IbcMessageId,
  IbcTransferInfo,
  Network,
  TxHash,
  WormholeMessageId,
  chainToPlatform,
  encoding,
  isIbcMessageId,
  isIbcTransferInfo,
  toChainId,
} from "@wormhole-foundation/connect-sdk";

import {
  AnyCosmwasmAddress,
  CosmwasmAddress,
  CosmwasmChains,
  CosmwasmPlatform,
  CosmwasmPlatformType,
  CosmwasmTransaction,
  CosmwasmUnsignedTransaction,
  Gateway,
  IBC_MSG_TYPE,
  IBC_PACKET_DATA,
  IBC_PACKET_DST,
  IBC_PACKET_DST_PORT,
  IBC_PACKET_RECEIVE,
  IBC_PACKET_SEND,
  IBC_PACKET_SEQ,
  IBC_PACKET_SRC,
  IBC_PACKET_SRC_PORT,
  IBC_TIMEOUT_MILLIS,
  IBC_TRANSFER_PORT,
  IbcChannels,
  computeFee,
  networkChainToChannels,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

import { CosmwasmWormholeCore } from "@wormhole-foundation/connect-sdk-cosmwasm-core";

const millisToNano = (seconds: number) => seconds * 1_000_000;

export class CosmwasmIbcBridge<N extends Network, C extends CosmwasmChains>
  implements IbcBridge<N, CosmwasmPlatformType, C>
{
  private gatewayAddress: string;

  // map the local channel ids to the remote chain
  private channelToChain: Map<string, CosmwasmChains> = new Map();
  private chainToChannel: Map<CosmwasmChains, string> = new Map();

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly rpc: CosmWasmClient,
    readonly contracts: Contracts,
  ) {
    if (!networkChainToChannels.has(network, chain))
      throw new Error("Unsupported IBC Chain, no channels available: " + chain);

    this.gatewayAddress = this.contracts.gateway!;

    const channels: IbcChannels = networkChainToChannels.get(network, chain) ?? {};

    for (const [chain, channel] of Object.entries(channels)) {
      this.channelToChain.set(channel, chain as CosmwasmChains);
      this.chainToChannel.set(chain as CosmwasmChains, channel);
    }
  }

  static async fromRpc<N extends Network>(
    rpc: CosmWasmClient,
    config: ChainsConfig<N, CosmwasmPlatformType>,
  ): Promise<CosmwasmIbcBridge<N, CosmwasmChains>> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error("Network mismatch: " + conf.network + " != " + network);
    return new CosmwasmIbcBridge(network as N, chain, rpc, conf.contracts);
  }

  getTransferChannel<C extends CosmwasmChains>(chain: C): string | null {
    return this.chainToChannel.get(chain) ?? null;
  }

  async *transfer(
    sender: AnyCosmwasmAddress,
    recipient: ChainAddress,
    token: AnyCosmwasmAddress | "native",
    amount: bigint,
  ): AsyncGenerator<CosmwasmUnsignedTransaction<N, C>> {
    const senderAddress = new CosmwasmAddress(sender).toString();
    const nonce = Math.round(Math.random() * 10000);

    // TODO: needs heavy testing
    let recipientAddress: string = encoding.b64.encode(
      chainToPlatform(recipient.chain) === "Cosmwasm"
        ? recipient.address.toString()
        : recipient.address.toUniversalAddress().toUint8Array(),
    );

    const payload: GatewayIbcTransferMsg = {
      gateway_ibc_token_bridge_payload: {
        gateway_transfer: {
          recipient: recipientAddress,
          chain: toChainId(recipient.chain),
          nonce,
          // TODO: fetch param of which contract?
          fee: "0",
        },
      },
    };

    const timeout = BigInt(millisToNano(Date.now() + IBC_TIMEOUT_MILLIS));
    const memo = JSON.stringify(payload);

    const ibcDenom =
      token === "native"
        ? CosmwasmPlatform.getNativeDenom(this.network, this.chain)
        : Gateway.deriveIbcDenom(this.network, this.chain, new CosmwasmAddress(token).toString());
    const ibcToken = coin(amount.toString(), ibcDenom.toString());

    const ibcMessage: MsgTransferEncodeObject = {
      typeUrl: IBC_MSG_TYPE,
      value: MsgTransfer.fromPartial({
        sourcePort: IBC_TRANSFER_PORT,
        sourceChannel: this.chainToChannel.get(Gateway.chain)!,
        sender: senderAddress,
        receiver: this.gatewayAddress,
        token: ibcToken,
        timeoutTimestamp: timeout,
        memo,
      }),
    };

    yield this.createUnsignedTx(
      {
        msgs: [ibcMessage],
        fee: computeFee(this.network, this.chain),
        memo: "Wormhole.TransferToGateway",
      },
      "IBC.transfer",
    );

    return;
  }

  async lookupTransferFromTx(txid: TxHash): Promise<IbcTransferInfo> {
    const txResults = await this.rpc.getTx(txid);

    if (!txResults) throw new Error(`No transaction found with txid: ${txid}`);
    if (txResults.code !== 0) throw new Error(`Transaction failed: ${txResults.rawLog}`);

    const xfers = await this.fetchTransferInfo(txResults!);

    if (xfers.length === 0) throw new Error("No transfers found for tx: " + txid);
    if (xfers.length > 1) console.error(">1 xfer in tx; why");

    return xfers[0]!;
  }

  async lookupMessageFromIbcMsgId(msg: IbcMessageId): Promise<WormholeMessageId | null> {
    const tx = await this.lookupTxFromIbcMsgId(msg);
    if (!tx) return null;
    return CosmwasmWormholeCore.parseWormholeMessage(
      Gateway.chain,
      Gateway.coreAddress(this.network),
      tx,
    );
  }

  // Private because we dont want to expose the IndexedTx type
  private async lookupTxFromIbcMsgId(msg: IbcMessageId): Promise<IndexedTx | null> {
    const prefix = this.chain === msg.chain ? IBC_PACKET_SEND : IBC_PACKET_RECEIVE;

    const { srcChannel, dstChannel, sequence, srcPort, dstPort } = msg;

    // Find the transaction with matching payload
    const txResults = await this.rpc.searchTx([
      {
        key: `${prefix}.${IBC_PACKET_DST}`,
        value: dstChannel,
      },
      {
        key: `${prefix}.${IBC_PACKET_SRC}`,
        value: srcChannel,
      },
      {
        key: `${prefix}.${IBC_PACKET_SRC_PORT}`,
        value: srcPort,
      },
      {
        key: `${prefix}.${IBC_PACKET_DST_PORT}`,
        value: dstPort,
      },
      {
        key: `${prefix}.${IBC_PACKET_SEQ}`,
        value: sequence.toString(),
      },
    ]);

    if (txResults.length === 0) return null;
    //throw new Error(
    //  `Found no transactions for message: ` + JSON.stringify(msg),
    //);

    if (txResults.length > 1)
      console.error(`Expected 1 transaction, got ${txResults.length} found for IbcMsgid: ${msg}`);

    const [tx] = txResults;
    return tx!;
  }

  async lookupTransferFromIbcMsgId(msg: IbcMessageId): Promise<IbcTransferInfo> {
    // Finds the transaction but there may be multiple
    // IBCTransfers as part of this
    const tx = await this.lookupTxFromIbcMsgId(msg);
    if (!tx) throw new Error(`No transfers found on ${this.chain} in tx: ${tx}`);

    const xfers = await this.fetchTransferInfo(tx);
    if (xfers.length === 0) throw new Error(`No transfers found on ${this.chain} in tx: ${tx}`);

    if (xfers.length > 1) throw new Error(`Found ${xfers.length} transfers, expected 1`);

    return xfers[0]!;
  }

  // Returns the IBC Transfer message content and IBC transfer information
  async lookupTransferFromMsg(
    msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
  ): Promise<IbcTransferInfo> {
    const encodedPayload = encoding.b64.encode(JSON.stringify(msg));

    // Find the transaction with matching payload
    const txResults = await this.rpc.searchTx([
      {
        key: "wasm.transfer_payload",
        value: encodedPayload,
      },
    ]);

    if (txResults.length === 0)
      throw new Error(`Found no transactions for payload: ` + JSON.stringify(encodedPayload));

    if (txResults.length !== 1) console.error("Expected 1 tx, got: ", txResults.length);

    const [tx] = txResults;
    const xfers = await this.fetchTransferInfo(tx!);

    if (xfers.length === 0)
      throw new Error(`Found no transactions for payload: ` + JSON.stringify(encodedPayload));

    if (xfers.length !== 1) console.error("Expected 1 xfer, got: ", xfers.length);

    return xfers[0]!;
  }

  private parseIbcTransferInfo(tx: IndexedTx): IbcTransferInfo[] {
    // Try to get all IBC packets (sent/received)
    const packets = tx.events.filter(
      (ev) => ev.type === IBC_PACKET_SEND || ev.type === IBC_PACKET_RECEIVE,
    );

    if (packets.length === 0)
      throw new Error(`No IBC Transfers on ${this.chain} found in: ${tx.hash}`);

    // Try to assemble attributes from packet fields
    const xfers = new Set<IbcTransferInfo>();
    for (const packet of packets) {
      const xfer: Partial<IbcTransferInfo> = { pending: false };
      const msgId: Partial<IbcMessageId> = {};
      for (const attr of packet.attributes) {
        // set on msgId
        if (attr.key === IBC_PACKET_SRC) msgId.srcChannel = attr.value;
        if (attr.key === IBC_PACKET_DST) msgId.dstChannel = attr.value;
        if (attr.key === IBC_PACKET_SEQ) msgId.sequence = Number(attr.value);
        if (attr.key === IBC_PACKET_SRC_PORT) msgId.srcPort = attr.value;
        if (attr.key === IBC_PACKET_DST_PORT) msgId.dstPort = attr.value;

        // set on the xfer obj
        if (attr.key === IBC_PACKET_DATA) xfer.data = JSON.parse(attr.value);
      }

      // If we're receiving a packet, we need figure out who sent it
      // possibly resolving by source channel
      // we assign the chain to the sender as iternally canonical
      msgId.chain =
        packet.type === IBC_PACKET_SEND ? this.chain : this.channelToChain.get(msgId.dstChannel!)!;

      // Note: using the type guard to tell us if we have all the fields we expect
      if (isIbcMessageId(msgId)) xfer.id = msgId;
      else throw new Error("Invalid IbcMessageId: " + JSON.stringify(msgId));

      if (isIbcTransferInfo(xfer)) xfers.add(xfer as IbcTransferInfo);
      else throw new Error("Invalid IbcTransferInfo: " + JSON.stringify(xfer));
    }
    return Array.from(xfers);
  }

  // fetch whether or not this transfer is pending
  private async fetchTransferInfo(tx: IndexedTx): Promise<IbcTransferInfo[]> {
    // Try to get all IBC packets (sent/received)
    const xfers = this.parseIbcTransferInfo(tx);

    const transfers: IbcTransferInfo[] = [];
    for (const xfer of xfers) {
      // If its present in the commitment results, its interpreted as in-flight
      // the client throws an error and we report any error as not in-flight
      const qc = CosmwasmPlatform.getQueryClient(this.rpc);
      try {
        await qc.ibc.channel.packetCommitment(
          IBC_TRANSFER_PORT,
          xfer.id.srcChannel!,
          xfer.id.sequence!,
        );
        xfer.pending = true;
      } catch (e) {
        // TODO: catch http errors unrelated to no commitment in flight
        // otherwise we might lie about pending = false
      }

      // TODO other states of packet in-flight-ness?

      transfers.push(xfer);
    }

    return transfers;
  }

  // Fetches the local channel for the given chain
  async fetchTransferChannel(chain: CosmwasmChains): Promise<string> {
    if (this.chain !== Gateway.chain)
      throw new Error("Cannot query the transfer channels from a non-gateway chain");

    const { channel } = await this.rpc.queryContractSmart(this.gatewayAddress, {
      ibc_channel: { chain_id: toChainId(chain) },
    });
    return channel;
  }

  private createUnsignedTx(
    txReq: CosmwasmTransaction,
    description: string,
    parallelizable: boolean = false,
  ): CosmwasmUnsignedTransaction<N, C> {
    return new CosmwasmUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
