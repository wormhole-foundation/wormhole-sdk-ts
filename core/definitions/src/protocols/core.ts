import { Network, Platform } from "@wormhole-foundation/sdk-base";
import { PlatformToChains } from "@wormhole-foundation/sdk-base/src";
import { AccountAddress } from "../address";
import { WormholeMessageId } from "../attestation";
import { TxHash } from "../types";
import { UnsignedTransaction } from "../unsignedTransaction";
export interface WormholeCore<N extends Network, P extends Platform, C extends PlatformToChains<P>> {
  publishMessage(
    sender: AccountAddress<C>,
    message: string | Uint8Array
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  parseTransaction(txid: TxHash): Promise<WormholeMessageId[]>;
  // TODO: events?
}
