import {
  AccountAddress as AptosAccountAddress,
  Aptos,
  InputGenerateTransactionPayloadData,
  InputScriptData,
  MoveVector,
  U32,
  U64,
  UserTransactionResponse,
} from "@aptos-labs/ts-sdk";
import {
  AptosPlatform,
  AptosUnsignedTransaction,
  type AptosChains,
} from "@wormhole-foundation/sdk-aptos";
import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Network,
  Platform,
} from "@wormhole-foundation/sdk-connect";
import {
  CircleBridge,
  CircleTransferMessage,
  circle,
  Contracts,
  encoding,
  keccak256,
} from "@wormhole-foundation/sdk-connect";
import { AptosCCTPMoveScripts, aptosCCTPMoveScripts } from "./moveScripts.js";

export class AptosCircleBridge<N extends Network, C extends AptosChains>
  implements CircleBridge<N, C>
{
  readonly usdcId: string;
  readonly tokenMessengerId: string;
  readonly messageTransmitterId: string;
  readonly moveScripts: AptosCCTPMoveScripts;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Aptos,
    readonly contracts: Contracts,
  ) {
    if (network === "Devnet") throw new Error("CircleBridge not supported on Devnet");

    const usdcId = circle.usdcContract.get(this.network, this.chain);
    if (!usdcId) {
      throw new Error(
        `No USDC contract configured for network=${this.network} chain=${this.chain}`,
      );
    }

    if (!contracts.cctp?.tokenMessenger)
      throw new Error(`Circle Token Messenger contract for domain ${chain} not found`);

    if (!contracts.cctp?.messageTransmitter)
      throw new Error(`Circle Message Transmitter contract for domain ${chain} not found`);

    if (!aptosCCTPMoveScripts.has(network)) throw new Error("No Aptos CCTP move scripts found");

    this.usdcId = usdcId;
    this.tokenMessengerId = contracts.cctp?.tokenMessenger;
    this.messageTransmitterId = contracts.cctp.messageTransmitter;
    this.moveScripts = aptosCCTPMoveScripts.get(network)!;
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<AptosUnsignedTransaction<N, C>> {
    const destinationDomain = new U32(circle.circleChainId.get(this.network, recipient.chain)!);
    const burnToken = AptosAccountAddress.from(this.usdcId);
    const mintRecipient = AptosAccountAddress.from(
      recipient.address.toUniversalAddress().toUint8Array(),
    );

    const functionArguments = [new U64(amount), destinationDomain, mintRecipient, burnToken];

    const txData: InputScriptData = {
      bytecode: this.moveScripts.depositForBurn,
      functionArguments,
    };

    yield this.createUnsignedTx(txData, "Aptos.CircleBridge.Transfer");
  }

  async isTransferCompleted(message: CircleBridge.Message): Promise<boolean> {
    const sourceBytes = new U32(message.sourceDomain).bcsToBytes();
    const nonceBytes = new U64(message.nonce).bcsToBytes();
    const hash = keccak256(new Uint8Array([...sourceBytes, "-".charCodeAt(0), ...nonceBytes]));
    const hashStr = encoding.hex.encode(hash);

    const isNonceUsed = await this.provider.view<[boolean]>({
      payload: {
        function: `${this.messageTransmitterId}::message_transmitter::is_nonce_used`,
        functionArguments: [hashStr],
      },
    });

    return isNonceUsed[0];
  }

  async *redeem(
    sender: AccountAddress<C>,
    message: CircleBridge.Message,
    attestation: string,
  ): AsyncGenerator<AptosUnsignedTransaction<N, C>> {
    const functionArguments = [
      MoveVector.U8(CircleBridge.serialize(message)),
      MoveVector.U8(encoding.hex.decode(attestation)),
    ];

    const txData: InputScriptData = {
      bytecode: this.moveScripts.handleReceiveMessage,
      functionArguments,
    };

    yield this.createUnsignedTx(txData, "Aptos.CircleBridge.Redeem");
  }

  async parseTransactionDetails(digest: string): Promise<CircleTransferMessage> {
    const tx = await this.provider.getTransactionByHash({ transactionHash: digest });

    const messageTransmitterId = this.messageTransmitterId.replace(/^0x0+/, "0x"); // remove any leading zeros to match event
    const circleMessageSentEvent = (tx as UserTransactionResponse).events?.find(
      (e) => e.type === `${messageTransmitterId}::message_transmitter::MessageSent`,
    );

    if (!circleMessageSentEvent) {
      throw new Error("No MessageSent event found");
    }

    const circleMessage = encoding.hex.decode(circleMessageSentEvent.data.message);

    const [msg, hash] = CircleBridge.deserialize(circleMessage);
    const { payload } = msg;

    const xferSender = payload.messageSender;
    const xferReceiver = payload.mintRecipient;

    const sendChain = circle.toCircleChain(this.network, msg.sourceDomain);
    const rcvChain = circle.toCircleChain(this.network, msg.destinationDomain);

    const token = { chain: sendChain, address: payload.burnToken };

    return {
      from: { chain: sendChain, address: xferSender },
      to: { chain: rcvChain, address: xferReceiver },
      token: token,
      amount: payload.amount,
      message: msg,
      id: { hash },
    };
  }

  static async fromRpc<N extends Network>(
    provider: Aptos,
    config: ChainsConfig<N, Platform>,
  ): Promise<AptosCircleBridge<N, AptosChains>> {
    const [network, chain] = await AptosPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network) {
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    }

    return new AptosCircleBridge(network as N, chain, provider, conf.contracts);
  }

  private createUnsignedTx(
    txReq: InputGenerateTransactionPayloadData,
    description: string,
    parallelizable: boolean = false,
  ): AptosUnsignedTransaction<N, C> {
    return new AptosUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
