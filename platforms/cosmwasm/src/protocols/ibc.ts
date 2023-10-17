import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { IndexedTx, MsgTransferEncodeObject, coin } from "@cosmjs/stargate";
import {
  ChainAddress,
  ChainName,
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
  isIbcMessageId,
  isIbcTransferInfo,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";

import {
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
  networkChainToChannels,
} from "../constants";
import { CosmwasmContracts } from "../contracts";
import { Gateway } from "../gateway";
import { CosmwasmPlatform } from "../platform";
import { CosmwasmUtils } from "../platformUtils";
import { CosmwasmChainName, AnyCosmwasmAddress } from "../types";
import {
  CosmwasmTransaction,
  CosmwasmUnsignedTransaction,
  computeFee,
} from "../unsignedTransaction";
import { CosmwasmAddress } from "../address";

const millisToNano = (seconds: number) => seconds * 1_000_000;

export class CosmwasmIbcBridge implements IbcBridge<"Cosmwasm"> {
  private gatewayAddress: string;

  // map the local channel ids to the remote chain
  private channelToChain: Map<string, CosmwasmChainName> = new Map();
  private chainToChannel: Map<CosmwasmChainName, string> = new Map();

  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: CosmwasmContracts,
  ) {
    this.gatewayAddress = this.contracts.getContracts(Gateway.name).gateway!;

    if (!networkChainToChannels.has(network, chain))
      throw new Error("Unsupported IBC Chain, no channels available: " + chain);

    // @ts-ignore
    const channels: IbcChannels = networkChainToChannels(network, chain);

    for (const [chain, channel] of Object.entries(channels)) {
      this.channelToChain.set(channel, chain as CosmwasmChainName);
      this.chainToChannel.set(chain as CosmwasmChainName, channel);
    }
  }

  static async fromProvider(
    rpc: CosmWasmClient,
    contracts: CosmwasmContracts,
  ): Promise<CosmwasmIbcBridge> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    return new CosmwasmIbcBridge(network, chain, rpc, contracts);
  }

  getTransferChannel(chain: ChainName): string | null {
    return this.chainToChannel.get(chain as CosmwasmChainName) ?? null;
  }

  async *transfer(
    sender: AnyCosmwasmAddress,
    recipient: ChainAddress,
    token: AnyCosmwasmAddress | "native",
    amount: bigint,
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    const senderAddress = new CosmwasmAddress(sender).toString();
    const nonce = Math.round(Math.random() * 10000);

    // TODO: needs heavy testing
    let recipientAddress;
    if (chainToPlatform(recipient.chain) === "Cosmwasm") {
      // If cosmwasm, we just want the b64 encoded string address
      recipientAddress = Buffer.from(recipient.address.toString()).toString(
        "base64",
      );
    } else {
      // If we're bridging out of cosmos, we need the universal address
      recipientAddress = Buffer.from(
        recipient.address.toUniversalAddress().toUint8Array(),
      ).toString("base64");
    }

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

    const timeout = millisToNano(Date.now() + IBC_TIMEOUT_MILLIS);
    const memo = JSON.stringify(payload);

    const ibcDenom =
      token === "native"
        ? CosmwasmPlatform.getNativeDenom(this.chain)
        : Gateway.deriveIbcDenom(
            this.chain,
            new CosmwasmAddress(token).toString(),
          );
    const ibcToken = coin(amount.toString(), ibcDenom.toString());

    const ibcMessage: MsgTransferEncodeObject = {
      typeUrl: IBC_MSG_TYPE,
      value: MsgTransfer.fromPartial({
        sourcePort: IBC_TRANSFER_PORT,
        sourceChannel: this.chainToChannel.get(Gateway.name)!,
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
        fee: computeFee(this.chain),
        memo: "Wormhole.TransferToGateway",
      },
      "IBC.transfer",
    );

    return;
  }

  async lookupTransferFromTx(txid: TxHash): Promise<IbcTransferInfo> {
    const txResults = await this.rpc.getTx(txid);

    if (!txResults) throw new Error(`No transaction found with txid: ${txid}`);
    if (txResults.code !== 0)
      throw new Error(`Transaction failed: ${txResults.rawLog}`);

    const xfers = await this.fetchTransferInfo(txResults!);

    if (xfers.length === 0)
      throw new Error("No transfers found for tx: " + txid);
    if (xfers.length > 1) console.error(">1 xfer in tx; why");

    return xfers[0];
  }

  async lookupMessageFromIbcMsgId(
    msg: IbcMessageId,
  ): Promise<WormholeMessageId | null> {
    const tx = await this.lookupTxFromIbcMsgId(msg);
    if (!tx) return null;
    return Gateway.parseWormholeMessage(tx);
  }

  // Private because we dont want to expose the IndexedTx type
  private async lookupTxFromIbcMsgId(
    msg: IbcMessageId,
  ): Promise<IndexedTx | null> {
    const prefix =
      this.chain === msg.chain ? IBC_PACKET_SEND : IBC_PACKET_RECEIVE;

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
      console.error(
        `Expected 1 transaction, got ${txResults.length} found for IbcMsgid: ${msg}`,
      );

    const [tx] = txResults;
    return tx;
  }

  async lookupTransferFromIbcMsgId(
    msg: IbcMessageId,
  ): Promise<IbcTransferInfo> {
    // Finds the transaction but there may be multiple
    // IBCTransfers as part of this
    const tx = await this.lookupTxFromIbcMsgId(msg);
    if (!tx)
      throw new Error(`No transfers found on ${this.chain} in tx: ${tx}`);

    const xfers = await this.fetchTransferInfo(tx);
    if (xfers.length === 0)
      throw new Error(`No transfers found on ${this.chain} in tx: ${tx}`);

    // TODO
    if (xfers.length > 1) console.error(">1 xfer in tx; why");

    return xfers[0];
  }

  // Returns the IBC Transfer message content and IBC transfer information
  async lookupTransferFromMsg(
    msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
  ): Promise<IbcTransferInfo> {
    const encodedPayload = Buffer.from(JSON.stringify(msg)).toString("base64");

    // Find the transaction with matching payload
    const txResults = await this.rpc.searchTx([
      {
        key: "wasm.transfer_payload",
        value: encodedPayload,
      },
    ]);

    if (txResults.length === 0)
      throw new Error(
        `Found no transactions for payload: ` + JSON.stringify(encodedPayload),
      );

    if (txResults.length !== 1)
      console.error("Expected 1 tx, got: ", txResults.length);

    const [tx] = txResults;
    const xfers = await this.fetchTransferInfo(tx);

    if (xfers.length === 0)
      throw new Error(
        `Found no transactions for payload: ` + JSON.stringify(encodedPayload),
      );

    if (xfers.length !== 1)
      console.error("Expected 1 xfer, got: ", xfers.length);

    return xfers[0];
  }

  private parseIbcTransferInfo(tx: IndexedTx): IbcTransferInfo[] {
    // Try to get all IBC packets (sent/received)
    const packets = tx.events.filter(
      (ev) => ev.type === IBC_PACKET_SEND || ev.type === IBC_PACKET_RECEIVE,
    );

    if (packets.length === 0)
      throw new Error(`No IBC Transfers on ${this.chain} found in: ${tx.hash}`);

    // TODO: gotta be a way to parse these out better?
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
        packet.type === IBC_PACKET_SEND
          ? this.chain
          : this.channelToChain.get(msgId.dstChannel!)!;

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
      const qc = CosmwasmUtils.asQueryClient(this.rpc);
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
  async fetchTransferChannel(chain: CosmwasmChainName): Promise<string> {
    if (this.chain !== Gateway.name)
      throw new Error(
        "Cannot query the transfer channels from a non-gateway chain",
      );

    const { channel } = await this.rpc.queryContractSmart(this.gatewayAddress, {
      ibc_channel: { chain_id: toChainId(chain) },
    });
    return channel;
  }

  private createUnsignedTx(
    txReq: CosmwasmTransaction,
    description: string,
    parallelizable: boolean = false,
  ): CosmwasmUnsignedTransaction {
    return new CosmwasmUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
