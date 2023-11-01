import { IndexedTx } from "@cosmjs/stargate";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

import {
  AnyAddress,
  ChainName,
  ChainsConfig,
  Contracts,
  Network,
  UniversalAddress,
  UnsignedTransaction,
  WormholeCore,
  WormholeMessageId,
} from "@wormhole-foundation/connect-sdk";
import {
  CosmwasmChainName,
  CosmwasmPlatform,
} from "@wormhole-foundation/connect-sdk-cosmwasm";

export class CosmwasmWormholeCore implements WormholeCore<"Cosmwasm"> {
  private coreAddress: string;

  private constructor(
    readonly network: Network,
    readonly chain: CosmwasmChainName,
    readonly rpc: CosmWasmClient,
    readonly contracts: Contracts,
  ) {
    const coreAddress = this.contracts.coreBridge!;
    if (!coreAddress)
      throw new Error(
        `Wormhole Token Bridge contract for domain ${chain} not found`,
      );

    this.coreAddress = coreAddress;
  }

  static async fromRpc(
    rpc: CosmWasmClient,
    config: ChainsConfig,
  ): Promise<CosmwasmWormholeCore> {
    const [network, chain] = await CosmwasmPlatform.chainFromRpc(rpc);
    return new CosmwasmWormholeCore(
      network,
      chain,
      rpc,
      config[chain]!.contracts,
    );
  }

  publishMessage(
    sender: AnyAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error("Method not implemented.");
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const tx = await this.rpc.getTx(txid);
    if (!tx) throw new Error("No transaction found for txid: " + txid);
    return [
      CosmwasmWormholeCore.parseWormholeMessage(
        this.chain,
        this.coreAddress,
        tx,
      ),
    ];
  }

  // TODO: make consts
  static parseWormholeMessage(
    chain: ChainName,
    coreAddress: string,
    tx: IndexedTx,
  ): WormholeMessageId {
    const events = tx.events.filter(
      (ev) =>
        ev.type === "wasm" &&
        ev.attributes[0].key === "_contract_address" &&
        ev.attributes[0].value === coreAddress,
    );

    if (events.length === 0) throw new Error("No wormhole message found in tx");
    if (events.length > 1)
      console.error(`Expected single message, found ${events.length}`);

    const [wasm] = events;

    const sequence = wasm.attributes.find((e) => {
      return e.key === "message.sequence";
    })!.value;

    const emitter = wasm.attributes.find((e) => {
      return e.key === "message.sender";
    })!.value;

    return {
      chain: chain,
      emitter: new UniversalAddress(emitter),
      sequence: BigInt(sequence),
    };
  }
}
