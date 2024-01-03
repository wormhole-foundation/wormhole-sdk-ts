import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { IndexedTx } from "@cosmjs/stargate";

import {
  Chain,
  ChainsConfig,
  Contracts,
  Network,
  UniversalAddress,
  VAA,
  WormholeCore,
  WormholeMessageId,
} from "@wormhole-foundation/connect-sdk";
import {
  AnyCosmwasmAddress,
  CosmwasmChains,
  CosmwasmPlatform,
  CosmwasmPlatformType,
  CosmwasmUnsignedTransaction,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

export class CosmwasmWormholeCore<N extends Network, C extends CosmwasmChains>
  implements WormholeCore<N, CosmwasmPlatformType, C>
{
  private coreAddress: string;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly rpc: CosmWasmClient,
    readonly contracts: Contracts,
  ) {
    const coreAddress = this.contracts.coreBridge!;
    if (!coreAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    this.coreAddress = coreAddress;
  }

  getMessageFee(): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  static async fromRpc<N extends Network>(
    rpc: CosmWasmClient,
    config: ChainsConfig<N, CosmwasmPlatformType>,
  ): Promise<CosmwasmWormholeCore<N, CosmwasmChains>> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    return new CosmwasmWormholeCore(network as N, chain, rpc, conf.contracts);
  }

  async *publishMessage(
    sender: AnyCosmwasmAddress,
    message: Uint8Array,
    nonce: number,
    consistencyLevel: number,
  ): AsyncGenerator<CosmwasmUnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }

  async *verifyMessage(sender: AnyCosmwasmAddress, vaa: VAA) {
    throw new Error("Not implemented.");
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const tx = await this.rpc.getTx(txid);
    if (!tx) throw new Error("No transaction found for txid: " + txid);
    return [CosmwasmWormholeCore.parseWormholeMessage(this.chain, this.coreAddress, tx)];
  }

  // TODO: make consts
  static parseWormholeMessage(chain: Chain, coreAddress: string, tx: IndexedTx): WormholeMessageId {
    const events = tx.events.filter(
      (ev) =>
        ev.type === "wasm" &&
        ev.attributes[0]!.key === "_contract_address" &&
        ev.attributes[0]!.value === coreAddress,
    );

    if (events.length === 0) throw new Error("No wormhole message found in tx");
    if (events.length > 1) console.error(`Expected single message, found ${events.length}`);

    const [wasm] = events;

    const sequence = wasm!.attributes.find((e) => {
      return e.key === "message.sequence";
    })!.value;

    const emitter = wasm!.attributes.find((e) => {
      return e.key === "message.sender";
    })!.value;

    return {
      chain: chain,
      emitter: new UniversalAddress(emitter),
      sequence: BigInt(sequence),
    };
  }
}
