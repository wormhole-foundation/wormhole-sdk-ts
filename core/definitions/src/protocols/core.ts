import { PlatformToChains, Network, Platform } from "@wormhole-foundation/sdk-base";
import { AccountAddress } from "../address";
import { WormholeMessageId } from "../attestation";
import { TxHash } from "../types";
import { UnsignedTransaction } from "../unsignedTransaction";
import { VAA } from "../vaa";

export interface WormholeCore<
  N extends Network,
  P extends Platform,
  C extends PlatformToChains<P>,
> {
  getMessageFee(): Promise<bigint>;
  publishMessage(
    sender: AccountAddress<C>,
    message: string | Uint8Array,
    nonce: number,
    consistencyLevel: number,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  verifyMessage(sender: AccountAddress<C>, vaa: VAA): AsyncGenerator<UnsignedTransaction<N, C>>;
  parseTransaction(txid: TxHash): Promise<WormholeMessageId[]>;
  // TODO: events?
}
