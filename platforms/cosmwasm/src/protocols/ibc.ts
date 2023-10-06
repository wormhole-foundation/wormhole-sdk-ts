import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { IndexedTx, MsgTransferEncodeObject, coin } from "@cosmjs/stargate";
import {
  ChainAddress,
  GatewayIbcTransferMsg,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcBridge,
  IbcTransferInfo,
  Network,
  TxHash,
  WormholeMessageId,
  chainToPlatform,
  toChainId,
  isIbcTransferInfo,
  IbcMessageId,
  isIbcMessageId,
  ChainName,
} from "@wormhole-foundation/connect-sdk";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";

import {
  IBC_MSG_TYPE,
  IBC_PACKET_DATA,
  IBC_PACKET_DST,
  IBC_PACKET_RECEIVE,
  IBC_PACKET_SEND,
  IBC_PACKET_SEQ,
  IBC_PACKET_SRC,
  IBC_TIMEOUT_MILLIS,
  IBC_TRANSFER_PORT,
  IbcChannel,
  networkChainToChannelId,
  networkChannelToChain,
  networkToChannelMap,
} from "../constants";
import { CosmwasmContracts } from "../contracts";
import { Gateway } from "../gateway";
import { CosmwasmPlatform } from "../platform";
import { CosmwasmUtils } from "../platformUtils";
import { CosmwasmChainName, UniversalOrCosmwasm } from "../types";
import {
  CosmwasmTransaction,
  CosmwasmUnsignedTransaction,
  computeFee,
} from "../unsignedTransaction";

const millisToNano = (seconds: number) => seconds * 1_000_000;

export class CosmwasmIbcBridge implements IbcBridge<"Cosmwasm"> {
  private gateway: string;

  // map the local channel ids to the remote chain
  private channelMap: Record<string, CosmwasmChainName>;

  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: CosmwasmContracts
  ) {
    this.gateway = this.contracts.getContracts(this.chain).gateway!;
    // Get channels from conf, conf is from the perspective of wormchain
    // so need to flip if !wormchain
    const isGateway = this.chain === Gateway.name;
    // TODO: why?
    // @ts-ignore
    this.channelMap = networkToChannelMap.get(network)!.reduce((acc, curr) => {
      const channelId = curr[1][isGateway ? "srcChannel" : "dstChannel"];
      const chainName = isGateway ? Gateway.name : curr[0];
      const record: Record<string, CosmwasmChainName> = {
        [channelId]: chainName,
      };
      return { ...acc, ...record };
    }, {}) as Record<string, CosmwasmChainName>;
  }

  static async fromProvider(
    rpc: CosmWasmClient,
    contracts: CosmwasmContracts
  ): Promise<CosmwasmIbcBridge> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    return new CosmwasmIbcBridge(network, chain, rpc, contracts);
  }

  async *transfer(
    sender: UniversalOrCosmwasm,
    recipient: ChainAddress,
    token: UniversalOrCosmwasm | "native",
    amount: bigint
  ): AsyncGenerator<CosmwasmUnsignedTransaction> {
    const senderAddress = sender.toString();
    const nonce = Math.round(Math.random() * 10000);

    // TODO: needs heavy testing
    let recipientAddress;
    if (chainToPlatform(recipient.chain) === "Cosmwasm") {
      // If cosmwasm, we just want the b64 encoded string address
      recipientAddress = Buffer.from(recipient.address.toString()).toString(
        "base64"
      );
    } else {
      // If we're bridging out of cosmos, we need the universal address
      recipientAddress = Buffer.from(
        recipient.address.toUniversalAddress().toUint8Array()
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

    const { dstChannel } = networkChainToChannelId(
      this.network,
      // @ts-ignore
      this.chain as CosmwasmChainName
    )!;

    const timeout = millisToNano(Date.now() + IBC_TIMEOUT_MILLIS);
    const memo = JSON.stringify(payload);

    const ibcDenom = await Gateway.deriveIbcDenom(this.chain, token.toString());
    const ibcToken = coin(amount.toString(), ibcDenom.toString());

    const ibcMessage: MsgTransferEncodeObject = {
      typeUrl: IBC_MSG_TYPE,
      value: MsgTransfer.fromPartial({
        sourcePort: IBC_TRANSFER_PORT,
        sourceChannel: dstChannel,
        sender: senderAddress,
        receiver: this.gateway,
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
      "IBC.transfer"
    );

    return;
  }

  async lookupTransferFromTx(txid: TxHash): Promise<IbcTransferInfo> {
    const txResults = await this.rpc.getTx(txid);
    if (!txResults) throw new Error(`No transaction found with txid: ${txid}`);
    if (txResults.code !== 0)
      throw new Error(`Transaction failed: ${txResults.rawLog}`);

    const xfers = await this.fetchTransferInfo(txResults!);
    const xfer = xfers.find((xfer) => xfer.tx.txid === txid);
    return xfer!;
  }

  async lookupMessageFromSequence(
    channel: string,
    incoming: boolean,
    sequence: number
  ): Promise<WormholeMessageId> {
    const tx = await this.lookupTxFromChannelSequence(
      channel,
      incoming,
      sequence
    );
    return Gateway.getWormholeMessage(tx);
  }

  private async lookupTxFromChannelSequence(
    channel: string,
    incoming: boolean,
    sequence: number
  ): Promise<IndexedTx> {
    const prefix = incoming ? IBC_PACKET_RECEIVE : IBC_PACKET_SEND;
    // Find the transaction with matching payload
    const txResults = await this.rpc.searchTx([
      {
        key: `${prefix}.${IBC_PACKET_DST}`,
        value: channel,
      },
      {
        key: `${prefix}.${IBC_PACKET_SEQ}`,
        value: sequence.toString(),
      },
    ]);

    if (txResults.length !== 1)
      throw new Error(
        `Expected 1 transaction, got ${txResults.length} found for dst/sequence: ${channel}/${sequence}`
      );

    const [tx] = txResults;
    return tx;
  }

  async lookupTransferFromSequence(
    channel: string,
    incoming: boolean,
    sequence: number
  ): Promise<IbcTransferInfo> {
    // Finds the transaction but there may be multiple
    // IBCTransfers as part of this
    const tx = await this.lookupTxFromChannelSequence(
      channel,
      incoming,
      sequence
    );

    const xfers = await this.fetchTransferInfo(tx);
    const xfer = xfers.find(
      (xfer) =>
        xfer.id.sequence === sequence &&
        channel === (incoming ? xfer.id.dstChannel : xfer.id.srcChannel)
    );

    return xfer!;
  }

  // Returns the IBC Transfer message content and IBC transfer information
  async lookupTransferFromMsg(
    msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg
  ): Promise<IbcTransferInfo> {
    const encodedPayload = Buffer.from(JSON.stringify(msg)).toString("base64");

    // Find the transaction with matching payload
    const txResults = await this.rpc.searchTx([
      {
        key: "wasm.transfer_payload",
        value: encodedPayload,
      },
    ]);

    if (txResults.length !== 1)
      throw new Error(
        `Expected 1 transaction, got ${txResults.length} found for payload: ${encodedPayload}`
      );

    const [tx] = txResults;
    const [xfer] = await this.fetchTransferInfo(tx);
    return xfer;
  }

  // Since this is private and only used in this class, we can assume
  // the tx was found on `this.chain`
  private async fetchTransferInfo(tx: IndexedTx): Promise<IbcTransferInfo[]> {
    // Try to get all IBC packets (sent/received)
    const packets = tx.events.filter(
      (ev) => ev.type === IBC_PACKET_SEND || ev.type === IBC_PACKET_RECEIVE
    );

    if (packets.length === 0)
      throw new Error(`No IBC Transfers found in: ${tx.hash}`);

    // Try to assemble attributes from packet fields
    const xfers = new Set<Partial<IbcTransferInfo>>();
    for (const packet of packets) {
      let xfer: Partial<IbcTransferInfo> = {};

      let msgId: Partial<IbcMessageId> = {};
      for (const attr of packet.attributes) {
        if (attr.key === IBC_PACKET_SRC) msgId.srcChannel = attr.value;
        if (attr.key === IBC_PACKET_DST) msgId.dstChannel = attr.value;
        if (attr.key === IBC_PACKET_SEQ) msgId.sequence = Number(attr.value);
        if (attr.key === IBC_PACKET_DATA) xfer.data = JSON.parse(attr.value);
      }

      // If we're receiving a packet, we need figure out who sent it
      msgId.chain =
        packet.type === IBC_PACKET_SEND
          ? this.chain
          : this.channelMap[msgId.dstChannel!];

      if (isIbcMessageId(msgId)) xfer.id = msgId;
      else throw new Error("Invalid IBC Message ID: " + JSON.stringify(msgId));

      xfers.add(xfer);
    }

    const transfers: IbcTransferInfo[] = [];
    for (const xfer of xfers) {
      const common = {
        ...xfer,
        chain: this.chain,
        pending: false,
      };

      // If we were missing properties in the above
      if (!isIbcTransferInfo(common)) continue;

      // If its present in the commitment results, its interpreted as in-flight
      // the client throws an error and we report any error as not in-flight
      const qc = CosmwasmUtils.asQueryClient(this.rpc);
      try {
        await qc.ibc.channel.packetCommitment(
          IBC_TRANSFER_PORT,
          common.id.srcChannel!,
          common.id.sequence!
        );
        transfers.push({ ...common, pending: true });
      } catch (e) {
        // TODO: catch http errors unrelated to no commitment in flight
        // otherwise we might lie about pending = false
      }

      transfers.push(common);
    }

    return transfers;
  }

  // Fetches the channel information between wormchain and a given chain
  async fetchChannel(chain: CosmwasmChainName): Promise<IbcChannel | null> {
    const queryClient = CosmwasmUtils.asQueryClient(this.rpc);
    try {
      const { channel: srcChannel } = await this.rpc.queryContractSmart(
        this.gateway,
        { ibc_channel: { chain_id: toChainId(chain) } }
      );
      const conn = await queryClient.ibc.channel.channel(
        IBC_TRANSFER_PORT,
        srcChannel
      );

      const dstChannel = conn.channel?.counterparty?.channelId;
      if (!dstChannel)
        throw new Error(`No destination channel found on chain ${chain}`);

      return { srcChannel, dstChannel };
    } catch {}
    return null;
  }

  private createUnsignedTx(
    txReq: CosmwasmTransaction,
    description: string,
    parallelizable: boolean = false
  ): CosmwasmUnsignedTransaction {
    return new CosmwasmUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable
    );
  }
}
