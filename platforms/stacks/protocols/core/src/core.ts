import { Contracts } from "@wormhole-foundation/sdk-connect";
import { AccountAddress, Network, TxHash, UnsignedTransaction, VAA, WormholeCore, WormholeMessageId } from "@wormhole-foundation/sdk-connect";
import { StacksChains, StacksPlatform } from '@wormhole-foundation/sdk-stacks';

export class StacksWormholeCore<N extends Network, C extends StacksChains> implements WormholeCore<N, C> {

  readonly coreContractAddress: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: any,
    readonly contracts: Contracts
  ) {
    const coreAddress = this.contracts.coreBridge;
    if (!coreAddress) throw new Error('Core bridge address not found');
    this.coreContractAddress = coreAddress;
  }

  getMessageFee(): Promise<bigint> {
    console.log(this.coreContractAddress)
    return Promise.resolve(999n);
    // throw new Error("Method not implemented.");
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

  static async fromRpc<N extends Network>(
    provider: any,
    config: any,
  ): Promise<StacksWormholeCore<N, "Stacks">> {
    const [network, chain] = await StacksPlatform.chainFromRpc(provider);
    const conf = config[chain]!;

    
    return new StacksWormholeCore<N, "Stacks">(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }
}
