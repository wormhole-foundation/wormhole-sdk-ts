import {
  Network,
  VAA,
  ChainAddress,
  TxHash,
  TokenTransferTransaction,
  toChainId,
  IbcBridge,
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
import {
  CosmwasmChainName,
  GatewayIbcTransferMsg,
  UniversalOrCosmwasm,
} from "../types";
import { CosmwasmPlatform } from "../platform";
import {
  IBC_MSG_TYPE,
  IBC_PORT,
  IBC_TIMEOUT_MILLIS,
  networkChainToChannelId,
} from "../constants";

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

  async parseTransactionDetails(
    txid: TxHash
  ): Promise<TokenTransferTransaction[]> {
    throw new Error("Not implemented");
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
