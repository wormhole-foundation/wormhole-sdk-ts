import type { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { SuiPlatform, type SuiChains, SuiUnsignedTransaction } from "@wormhole-foundation/sdk-sui";
import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Network,
  Platform,
} from '@wormhole-foundation/sdk-connect';
import {
  CircleBridge,
  CircleTransferMessage,
  circle,
  Contracts,
} from '@wormhole-foundation/sdk-connect';

import { suiCircleObjects } from "./objects.js";


export class SuiCircleBridge<N extends Network, C extends SuiChains>
  implements CircleBridge<N, C> {

    readonly usdcId: string;
    readonly usdcTreasuryId: string;
    readonly tokenMessengerId: string;
    readonly tokenMessengerStateId: string;
    readonly messageTransmitterId: string;
    readonly messageTransmitterStateId: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: SuiClient,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('CircleBridge not supported on Devnet');

    const usdcId = circle.usdcContract.get(this.network,  this.chain);
    if (!usdcId) {
      throw new Error(`No USDC contract configured for network=${this.network} chain=${this.chain}`);
    }

    const {
      tokenMessengerState,
      messageTransmitterState,
      usdcTreasury,
    } = suiCircleObjects(network as "Mainnet" | "Testnet");

    if (!contracts.cctp?.tokenMessenger) 
      throw new Error(
        `Circle Token Messenger contract for domain ${chain} not found`,
      );

    if (!contracts.cctp?.messageTransmitter) 
      throw new Error(
        `Circle Message Transmitter contract for domain ${chain} not found`,
      );

    this.usdcId = usdcId;
    this.usdcTreasuryId = usdcTreasury;
    this.tokenMessengerId = contracts.cctp?.tokenMessenger;
    this.messageTransmitterId = contracts.cctp?.messageTransmitter;
    this.tokenMessengerStateId = tokenMessengerState;
    this.messageTransmitterStateId = messageTransmitterState;
    
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const tx = new TransactionBlock();

   const destinationDomain = circle.circleChainId.get(
      this.network,
      recipient.chain,
    )!;

    const [usdcStruct] = await SuiPlatform.getCoins(this.provider, sender, this.usdcId);

    console.log(this.provider, sender, this.usdcId);

    if (!usdcStruct) {
      throw new Error('No USDC in wallet');
    }

    // It thinks balance is not a property when it is
    // Maybe need to update SDK?
    /* @ts-ignore */
    if (usdcStruct.balance < amount) {
      throw new Error('Amount exceeds USDC balance');
    }

    const [coin] = tx.splitCoins(
      usdcStruct.coinObjectId,
      [amount]
    );

    tx.moveCall({
      target: `${this.tokenMessengerId}::deposit_for_burn::deposit_for_burn`,
      arguments: [
        coin!,
        tx.pure.u32(destinationDomain), // destination_domain
        tx.pure.address(recipient.toString()), // mint_recipient
        tx.object(this.tokenMessengerStateId), // token_messenger_minter state
        tx.object(this.messageTransmitterStateId), // message_transmitter state
        tx.object("0x403"), // deny_list id, fixed address
        tx.object(this.usdcTreasuryId) // treasury object Treasury<USDC>
      ],
      typeArguments: [this.usdcId],
    });

    yield this.createUnsignedTx(tx, "Sui.CircleBridge.Transfer")
  }

  async isTransferCompleted(message: CircleBridge.Message): Promise<boolean> {
    /* TODO */
    return false;
  }

  async *redeem(
    sender: AccountAddress<C>,
    message: CircleBridge.Message,
    attestation: string,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    /* TODO */
  }

  async parseTransactionDetails(digest: string): Promise<CircleTransferMessage> {
    const tx = await this.provider.waitForTransactionBlock({
      digest,
      options: { showEvents: true, showEffects: true, showInput: true },
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }
    if (!tx.events) {
      throw new Error('Transaction events not found');
    }

    const circleMessageSentEvent = (tx.events?.find((event) =>
      event.type.includes("send_message::MessageSent")
    ));

    if (!circleMessageSentEvent) {
      throw new Error('No MessageSent event found');
    }

    const circleMessage = new Uint8Array((circleMessageSentEvent?.parsedJson as any).message);

    const [msg, hash] = CircleBridge.deserialize(circleMessage);
    const { payload: body } = msg;

    const xferSender = body.messageSender;
    const xferReceiver = body.mintRecipient;

    const sendChain = circle.toCircleChain(this.network, msg.sourceDomain);
    const rcvChain = circle.toCircleChain(this.network, msg.destinationDomain);

    const token = { chain: sendChain, address: body.burnToken };

    return {
      from: { chain: sendChain, address: xferSender },
      to: { chain: rcvChain, address: xferReceiver },
      token: token,
      amount: body.amount,
      message: msg,
      id: { hash },
    };
  }

  static async fromRpc<N extends Network>(
    provider: SuiClient,
    config: ChainsConfig<N, Platform>,
  ): Promise<SuiCircleBridge<N, SuiChains>> {
    const [network, chain] = await SuiPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network) {
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    }

    return new SuiCircleBridge(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  private createUnsignedTx(
    txReq: TransactionBlock,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }

}
