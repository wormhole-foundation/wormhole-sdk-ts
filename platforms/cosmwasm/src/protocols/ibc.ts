import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { IndexedTx, MsgTransferEncodeObject, coin } from "@cosmjs/stargate";
import {
  ChainAddress,
  GatewayIbcTransferMsg,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IBCTransferInfo,
  IbcBridge,
  Network,
  TxHash,
  WormholeMessageId,
  chainToPlatform,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";

import { isIbcTransferInfo } from "@wormhole-foundation/sdk-definitions/src";
import {
  IBC_MSG_TYPE,
  IBC_PORT,
  IBC_TIMEOUT_MILLIS,
  networkChainToChannelId,
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
  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: CosmwasmContracts
  ) {
    this.gateway = this.contracts.getContracts(this.chain).gateway!;
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

    const { dst } = networkChainToChannelId(
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
        sourcePort: IBC_PORT,
        sourceChannel: dst,
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

  async lookupTransferFromTx(txid: TxHash): Promise<IBCTransferInfo> {
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
    return Gateway.getWormholeMessage(this.chain, tx);
  }

  private async lookupTxFromChannelSequence(
    channel: string,
    incoming: boolean,
    sequence: number
  ): Promise<IndexedTx> {
    const prefix = incoming ? "recv_packet" : "send_packet";
    // Find the transaction with matching payload
    const txResults = await this.rpc.searchTx([
      {
        key: `${prefix}.packet_dst_channel`,
        value: channel,
      },
      {
        key: `${prefix}.packet_sequence`,
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
  ): Promise<IBCTransferInfo> {
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
        xfer.sequence === sequence &&
        channel === (incoming ? xfer.dstChannel : xfer.srcChannel)
    );

    return xfer!;
  }

  // Returns the IBC Transfer message content and IBC transfer information
  async lookupTransferFromMsg(
    msg: GatewayTransferMsg | GatewayTransferWithPayloadMsg
  ): Promise<IBCTransferInfo> {
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

  private async fetchTransferInfo(tx: IndexedTx): Promise<IBCTransferInfo[]> {
    // TODO: make consts
    const packets = tx.events.filter(
      (ev) => ev.type === "send_packet" || ev.type === "recv_packet"
    );

    if (packets.length === 0)
      throw new Error(`No IBC Transfers found in: ${tx.hash}`);

    // Try to assemble attributes from packet fields
    const xfers = new Set<Partial<IBCTransferInfo>>();
    for (const packet of packets) {
      let xfer: Partial<IBCTransferInfo> = {};
      for (const attr of packet.attributes) {
        if (attr.key === "packet_sequence") xfer.sequence = Number(attr.value);
        if (attr.key === "packet_dst_channel") xfer.dstChannel = attr.value;
        if (attr.key === "packet_src_channel") xfer.srcChannel = attr.value;
        if (attr.key === "packet_data") xfer.data = JSON.parse(attr.value);
      }
      xfers.add(xfer);
    }

    const transfers: IBCTransferInfo[] = [];
    for (const xfer of xfers) {
      const common = {
        ...xfer,
        tx: { chain: this.chain, txid: tx.hash },
        pending: false,
      };

      // If we were missing properties in the above
      if (!isIbcTransferInfo(common)) continue;

      // If its present in the commitment results, its interpreted as in-flight
      // the client throws an error and we report any error as not in-flight
      const qc = CosmwasmUtils.asQueryClient(this.rpc);
      try {
        await qc.ibc.channel.packetCommitment(
          IBC_PORT,
          common.srcChannel!,
          common.sequence!
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
