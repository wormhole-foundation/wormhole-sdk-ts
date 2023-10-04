import {
  Network,
  ChainAddress,
  toChainId,
  IbcBridge,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  GatewayIbcTransferMsg,
  IBCTransferInfo,
  IBCTransferData,
  toChainName,
  isGatewayTransferMsg,
} from "@wormhole-foundation/connect-sdk";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { coin, MsgTransferEncodeObject } from "@cosmjs/stargate";

import {
  CosmwasmTransaction,
  computeFee,
  CosmwasmUnsignedTransaction,
} from "../unsignedTransaction";
import { CosmwasmContracts } from "../contracts";
import { CosmwasmChainName, UniversalOrCosmwasm } from "../types";
import { CosmwasmPlatform } from "../platform";
import {
  IBC_MSG_TYPE,
  IBC_PORT,
  IBC_TIMEOUT_MILLIS,
  networkChainToChannelId,
} from "../constants";
import { Gateway } from "../gateway";
import { CosmwasmUtils } from "../platformUtils";

const millisToNano = (seconds: number) => seconds * 1_000_000;

export class CosmwasmIbcBridge implements IbcBridge<"Cosmwasm"> {
  private channelId: string;
  private gateway: string;
  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: CosmwasmContracts
  ) {
    this.gateway = this.contracts.getContracts(this.chain).gateway!;
    this.channelId = networkChainToChannelId(
      network,
      // @ts-ignore
      chain as CosmwasmChainName
    );
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
    const recipientAddress = Buffer.from(
      recipient.address.toUniversalAddress().toUint8Array()
    ).toString("base64");

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

    const ibcMessage: MsgTransferEncodeObject = {
      typeUrl: IBC_MSG_TYPE,
      value: MsgTransfer.fromPartial({
        sourcePort: IBC_PORT,
        sourceChannel: this.channelId,
        sender: senderAddress,
        receiver: this.gateway,
        token: coin(amount.toString(), token.toString()),
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

  // TODO: lookup by txid or GatewayIbcTransferMessage
  // Returns the IBC Transfer message content and IBC transfer information
  async lookupTransfer(
    payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
    rpc?: CosmWasmClient
  ): Promise<IBCTransferInfo> {
    rpc = rpc ? rpc : await Gateway.getRpc();

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64"
    );

    // Find the transaction with matching payload
    const txResults = await rpc.searchTx([
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

    // Find packet and parse the sequence from the IBC send event
    const seq = tx.events
      .find((ev) => ev.type === "send_packet")
      ?.attributes.find((attr) => attr.key === "packet_sequence");
    if (!seq) throw new Error("No event found to identify sequence number");
    const sequence = Number(seq.value);

    // find and parse the payload from the IBC send event
    const _data = tx.events
      .find((ev) => ev.type === "send_packet")
      ?.attributes.find((attr) => attr.key === "packet_data");
    const data = (_data ? JSON.parse(_data.value) : {}) as IBCTransferData;

    // figure out the which channels should we check
    const finalDest = toChainName(
      isGatewayTransferMsg(payload)
        ? payload.gateway_transfer.chain
        : payload.gateway_transfer_with_payload.chain
    ) as CosmwasmChainName;

    const srcChan = await Gateway.getSourceChannel(finalDest, rpc);
    const dstChan = await Gateway.getDestinationChannel(finalDest, rpc);

    const common = { sequence, srcChan, dstChan, data };

    // If its present in the commitment results, its interpreted as in-flight
    // the client throws an error and we report any error as not in-flight
    const qc = CosmwasmUtils.asQueryClient(rpc);
    try {
      await qc.ibc.channel.packetCommitment(IBC_PORT, srcChan, sequence);
      return { ...common, pending: true };
    } catch (e) {
      // TODO: catch http errors unrelated to no commitment in flight
      // otherwise we might lie about pending = false
    }
    return { ...common, pending: false };
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
