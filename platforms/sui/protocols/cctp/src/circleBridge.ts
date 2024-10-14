import { TransactionBlock } from "@mysten/sui.js/transactions";
import { SuiPlatform, type SuiBuildOutput, type SuiChains, SuiUnsignedTransaction } from "@wormhole-foundation/sdk-sui";
import { AccountAddress, ChainAddress, CircleBridge, CircleTransferMessage, circle, contracts } from '@wormhole-foundation/sdk-connect';

export class SuiCircleBridge<N extends Network, C extends SuiChains>
  implements CircleBridge<N, C> {

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: SuiClient,
    readonly contracts: Contracts,
  ) {

  }



  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const tx = new TransactionBlock();

    const usdcId = circle.usdcContract.get(this.network,  this.chain);
    const {
      tokenMessenger,
      //messageTransmitter,
    } = contracts.circleContracts(this.network, this.chain);

    const {
      tokenMessengerState,
      messageTransmitterState,
      usdcTreasury,
    } = contracts.suiCircleObjects(this.network);

    const destinationDomain = circle.circleChainId.get(
      this.network,
      recipient.chain,
    )!;

    if (!usdcId) {
      throw new Error(`No USDC contract configured for network=${this.network} chain=${this.chain}`);
    }

    const [usdcStruct] = await SuiPlatform.getCoins(this.provider, sender, usdcId);

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
      target: `${tokenMessenger}::deposit_for_burn::deposit_for_burn`,
      arguments: [
        tx.object(coin), // Coin<USDC>
        tx.pure.u32(destinationDomain), // destination_domain
        tx.pure.address(recipient.toString()), // mint_recipient
        tx.object(tokenMessengerState), // token_messenger_minter state
        tx.object(messageTransmitterState), // message_transmitter state
        tx.object("0x403"), // deny_list id, fixed address
        tx.object(usdcTreasury) // treasury object Treasury<USDC>
      ],
      typeArguments: [usdcId],
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

  async parseTransactionDetails(txid: string): Promise<CircleTransferMessage> {
    /* TODO */
  }

  private createUnsignedTx(
    txReq: TransactionBlock,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    return new SuiUnsignedTransaction(txReq, this.network, this.chain, description, parallelizable);
  }

}
