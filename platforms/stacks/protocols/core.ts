import { AccountAddress, Network, TxHash, UnsignedTransaction, VAA, WormholeCore, WormholeMessageId } from "@wormhole-foundation/sdk-connect";
import { StacksChains } from "../src/types.js";

export class StacksWormholeCore<N extends Network, C extends StacksChains> implements WormholeCore<N, C> {
  getMessageFee(): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  getGuardianSetIndex(): Promise<number> {
    throw new Error("Method not implemented.");
  }
  getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    throw new Error("Method not implemented.");
  }
  publishMessage(sender: AccountAddress<C>, message: string | Uint8Array, nonce: number, consistencyLevel: number): AsyncGenerator<UnsignedTransaction<N, C>, any, any> {
    throw new Error("Method not implemented.");
  }
  verifyMessage(sender: AccountAddress<C>, vaa: VAA): AsyncGenerator<UnsignedTransaction<N, C>, any, any> {
    throw new Error("Method not implemented.");
  }
  parseTransaction(txid: TxHash): Promise<WormholeMessageId[]> {
    throw new Error("Method not implemented.");
  }
  parseMessages(txid: TxHash): Promise<VAA<"Uint8Array">[]> {
    throw new Error("Method not implemented.");
  }
}
