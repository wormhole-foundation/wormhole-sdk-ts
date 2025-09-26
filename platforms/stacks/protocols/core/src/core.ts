import { StacksNetwork } from "@stacks/network";
import { Cl, cvToValue, deserializeCV, fetchCallReadOnlyFunction, PostConditionMode } from "@stacks/transactions";
import { ChainsConfig } from "@wormhole-foundation/sdk-connect";
import { serialize, UniversalAddress } from "@wormhole-foundation/sdk-connect";
import { Contracts } from "@wormhole-foundation/sdk-connect";
import { AccountAddress, Network, TxHash, UnsignedTransaction, VAA, WormholeCore, WormholeMessageId } from "@wormhole-foundation/sdk-connect";
import { StacksChains, StacksPlatform, StacksPlatformType, StacksZeroAddress } from '@wormhole-foundation/sdk-stacks';

export type StacksWormholeMessageId = WormholeMessageId & {
  emitterPrincipal: string
  payload: string
}

export class StacksWormholeCore<N extends Network, C extends StacksChains> implements WormholeCore<N, C> {

  static readonly CORE_CONTRACT_NAME: string = "wormhole-core-v4";
  static readonly STATE_CONTRACT_NAME: string = "wormhole-core-state";
  static readonly PROXY_CONTRACT_NAME: string = "wormhole-core-proxy-v2";
  
  readonly coreContractAddress: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: StacksNetwork,
    readonly contracts: Contracts
  ) {
    const coreAddress = this.contracts.coreBridge;
    if (!coreAddress) throw new Error('Core bridge address not found');
    this.coreContractAddress = coreAddress;
  }

  async getMessageFee(): Promise<bigint> {
    const activeCoreContract = await this.getActiveCoreContract()

    const res = await this.readonly(
      'get-message-fee',
      [
        Cl.address(activeCoreContract)
      ],
      StacksWormholeCore.PROXY_CONTRACT_NAME
    )
    return cvToValue(res.value)
  }
  async getGuardianSetIndex(): Promise<number> {
    const res = await this.readonly('get-active-guardian-set', [])
    const value = cvToValue(res.value)
    return Number(value['set-id'].value)
  }
  
  async getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    const res = await this.readonly('get-active-guardian-set', [])
    const value = cvToValue(res.value)
    const activeGuardianSetIndex = Number(value['set-id'].value)
    if(index !== activeGuardianSetIndex) {
      throw new Error('Only latest guardian set is supported in Stacks')
    }

    const guardians = value['guardians'].value.map((v: any) => v.value['compressed-public-key'].value)

    return {
      expiry: 0n,
      index: activeGuardianSetIndex,
      keys: guardians
    }
  }

  async *publishMessage(sender: AccountAddress<C>, message: string | Uint8Array, nonce: number, consistencyLevel: number): AsyncGenerator<UnsignedTransaction<N, C>, any, any> {
    const activeCoreContract = await this.getActiveCoreContract()
      const tx = {
        contractName: StacksWormholeCore.PROXY_CONTRACT_NAME,
        contractAddress: this.coreContractAddress,
        functionName: 'post-message',
        functionArgs: [
          Cl.address(activeCoreContract),
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

  // read-only in stacks, failing if we call this function signing a transaction instead of using a call
  async *verifyMessage(sender: AccountAddress<C>, vaa: VAA): AsyncGenerator<any, any, any> {
    const res = await this.readonly('parse-and-verify-vaa', [Cl.buffer(serialize(vaa))])
    if(res.value.type !== 'ok') {
      throw new Error(`Failed to verify VAA: ${res.value.data}`)
    }
    return res.value.data
  }
  
  async parseTransaction(txid: TxHash): Promise<StacksWormholeMessageId[]> {
    const apiUrl = `${this.provider.client.baseUrl}/extended/v1/tx/${txid}`
    const res = await fetch(apiUrl)
    let data = await res.json()

    let retries = 0;
    while((!data || !data?.tx_status || data?.tx_status === 'pending') && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      data = await fetch(apiUrl).then(res => res.json())
      retries++
    }
    if(data.tx_status !== 'success') {
      return []
    }

    if(!data) {
      return []
    }

    const events = data.events
    
    const whEvent = events.filter((e: any) => {
      return e.event_type === "smart_contract_log"
        && e.contract_log?.contract_id?.includes(StacksWormholeCore.STATE_CONTRACT_NAME)
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
        payload: e['payload'].value,
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
    return StacksWormholeCore.CORE_CONTRACT_NAME;
  }

  async isActiveDeployment(contractName?: string): Promise<boolean> {
    const res = await this.readonly('is-active-deployment', [], contractName ?? StacksWormholeCore.CORE_CONTRACT_NAME)
    return cvToValue(res)
  }

  private readonly(functionName: string, functionArgs: any[], contractName?: string): Promise<any> {
    return fetchCallReadOnlyFunction({
      contractName: contractName ?? this.contractName(),
      contractAddress: this.coreContractAddress,
      functionName,
      functionArgs,
      client: {
        baseUrl: this.provider.client.baseUrl
      },
      senderAddress: StacksZeroAddress
    })
  }

  private async getActiveCoreContract(): Promise<string> {
    const res = await this.readonly('get-active-wormhole-core-contract', [], StacksWormholeCore.STATE_CONTRACT_NAME)
    return cvToValue(res).value
  }

  static async fromRpc<N extends Network>(
    provider: StacksNetwork,
    config: ChainsConfig<N, StacksPlatformType>,
  ): Promise<StacksWormholeCore<N, StacksChains>> {
    const [network, chain] = await StacksPlatform.chainFromRpc(provider);
    const conf = config[chain]!;

    return new StacksWormholeCore<N, typeof chain>(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }
}
