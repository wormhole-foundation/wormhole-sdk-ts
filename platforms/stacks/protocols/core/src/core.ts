import { Cl, cvToValue, deserializeCV, fetchCallReadOnlyFunction, PostConditionMode } from "@stacks/transactions";
import { UniversalAddress } from "@wormhole-foundation/sdk-connect";
import { Contracts } from "@wormhole-foundation/sdk-connect";
import { AccountAddress, Network, TxHash, UnsignedTransaction, VAA, WormholeCore, WormholeMessageId } from "@wormhole-foundation/sdk-connect";
import { StacksChains, StacksPlatform, StacksZeroAddress } from '@wormhole-foundation/sdk-stacks';

export type StacksWormholeMessageId = WormholeMessageId & {
  emitterPrincipal: string
}

export class StacksWormholeCore<N extends Network, C extends StacksChains> implements WormholeCore<N, C> {

  readonly CORE_CONTRACT_NAME: string = "wormhole-core-v4";
  readonly STATE_CONTRACT_NAME: string = "wormhole-core-state";

  readonly coreContractAddress: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: any, // TODO FG TODO type
    readonly contracts: Contracts
  ) {
    const coreAddress = this.contracts.coreBridge;
    if (!coreAddress) throw new Error('Core bridge address not found');
    this.coreContractAddress = coreAddress;
  }

  async getMessageFee(): Promise<bigint> {
    const res = await this.readonly('get-message-fee', [])
    return cvToValue(res.value)
  }
  async getGuardianSetIndex(): Promise<number> {
    const res = await this.readonly('get-active-guardian-set', [])
    return cvToValue(res.value)
  }
  
  getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    throw new Error("Method not implemented.");
  }

  async *publishMessage(sender: AccountAddress<C>, message: string | Uint8Array, nonce: number, consistencyLevel: number): AsyncGenerator<UnsignedTransaction<N, C>, any, any> {
      const tx = {
        contractName: this.CORE_CONTRACT_NAME,
        contractAddress: this.coreContractAddress,
        functionName: 'post-message',
        functionArgs: [
          Cl.buffer(message instanceof Uint8Array ? message : new TextEncoder().encode(message)),
          Cl.uint(nonce),
          Cl.some(Cl.uint(consistencyLevel))
        ],
        postConditionMode: PostConditionMode.Allow,
      }
      yield {
        transaction: tx,
        network: this.network,
        chain: this.chain,
        description: 'StacksWormholeCore.publishMessage',
        parallelizable: false,
      }
  }

  verifyMessage(sender: AccountAddress<C>, vaa: VAA): AsyncGenerator<UnsignedTransaction<N, C>, any, any> {
    throw new Error("Method not implemented.");
  }
  
  async parseTransaction(txid: TxHash): Promise<StacksWormholeMessageId[]> {
    const apiUrl = `${this.provider.client.baseUrl}/extended/v1/tx/${txid}`
    const res = await fetch(apiUrl)
    const data = await res.json()
    if(!data) {
      return []
    }
    if(data.tx_status !== 'success') {
      // FG TODO FG should we throw? should we console debug?
      return []
    }

    const events = data.events
    
    const whEvent = events.filter((e: any) => {
      return e.event_type === "smart_contract_log"
        && e.contract_log?.contract_id === `${this.coreContractAddress}.${this.STATE_CONTRACT_NAME}`
        && e.contract_log?.topic === "print"
        && e.contract_log?.value?.repr?.includes("post-message")
    })
    const parsedEvents: any = whEvent.map((e: any) => deserializeCV(e.contract_log?.value?.hex))
    if(!parsedEvents) {
      return []
    }

    const eventValues = parsedEvents.map((e: any) => e.value?.data?.value)
    if(!eventValues) {
      return []
    }
    return Promise.resolve(eventValues.map((e: any) => {
      return {
        chain: this.chain,
        emitter: new UniversalAddress(e['emitter'].value),
        sequence: e['sequence'].value,
        emitterPrincipal: e['emitter-principal'].value,
      }
    }))
  }

  parseMessages(txid: TxHash): Promise<VAA<"Uint8Array">[]> {
    throw new Error("Method not implemented.");
  }

  contractAddress(): string {
    return this.coreContractAddress;
  }

  contractName(): string {
    return this.CORE_CONTRACT_NAME;
  }

  private readonly(functionName: string, functionArgs: any[]): Promise<any> {
    return fetchCallReadOnlyFunction({
      contractName: this.contractName(),
      contractAddress: this.coreContractAddress,
      functionName,
      functionArgs,
      client: {
        baseUrl: this.provider.client.baseUrl
      },
      senderAddress: StacksZeroAddress
    })
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
