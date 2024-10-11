import type { SuiBuildOutput, SuiChains, SuiUnsignedTransaction } from "@wormhole-foundation/sdk-sui";
import { AccountAddress, ChainAddress, CircleBridge, CircleTransferMessage, circle } from '@wormhole-foundation/sdk-connect';

export class SuiCircleBridge<N extends Network, C extends SuiChains>
  implements CircleBridge<N, C> {

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    /* TODO */
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
}
