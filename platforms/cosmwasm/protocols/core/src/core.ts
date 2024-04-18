import type { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import type { IndexedTx } from "@cosmjs/stargate";

import type {
  Chain,
  ChainsConfig,
  Contracts,
  Network,
  VAA,
  WormholeCore,
  WormholeMessageId,
} from "@wormhole-foundation/sdk-connect";
import { UniversalAddress, createVAA, encoding } from "@wormhole-foundation/sdk-connect";

import type {
  AnyCosmwasmAddress,
  CosmwasmChains,
  CosmwasmPlatformType,
  CosmwasmUnsignedTransaction,
} from "@wormhole-foundation/sdk-cosmwasm";
import { CosmwasmPlatform } from "@wormhole-foundation/sdk-cosmwasm";

export class CosmwasmWormholeCore<N extends Network, C extends CosmwasmChains>
  implements WormholeCore<N, C>
{
  private coreAddress: string;

  constructor(
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
  getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    throw new Error("Method not implemented.");
  }
  getGuardianSetIndex(): Promise<number> {
    throw new Error("Method not implemented.");
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
    return [CosmwasmWormholeCore.parseWormholeMessageId(this.chain, this.coreAddress, tx)];
  }

  async parseMessages(txid: string) {
    const tx = await this.rpc.getTx(txid);
    if (!tx) throw new Error("No transaction found for txid: " + txid);
    return [CosmwasmWormholeCore.parseWormholeMessage(this.chain, this.coreAddress, tx)];
  }

  static parseWormholeMessage(chain: Chain, coreAddress: string, tx: IndexedTx) {
    const events = tx.events.filter(
      (ev) =>
        ev.type === "wasm" &&
        ev.attributes[0]!.key === "_contract_address" &&
        ev.attributes[0]!.value === coreAddress,
    );

    if (events.length === 0) throw new Error("No wormhole message found in tx");
    if (events.length > 1) console.error(`Expected single message, found ${events.length}`);

    const [wasm] = events;

    const obj = Object.fromEntries(
      wasm!.attributes.map((attr) => {
        return [attr.key.split(".")[1]!, attr.value];
      }),
    );

    return createVAA("Uint8Array", {
      emitterChain: chain,
      emitterAddress: new UniversalAddress(encoding.hex.decode(obj["sender"]!)),
      sequence: BigInt(obj["sequence"]!),

      guardianSet: 0, // TODO: need to implement guardian set idx
      timestamp: Number(obj["block_time"]),
      consistencyLevel: 0,
      nonce: Number(obj["nonce"]),
      signatures: [],
      payload: encoding.hex.decode(obj["message"]!),
    });
  }
  static parseWormholeMessageId(
    chain: Chain,
    coreAddress: string,
    tx: IndexedTx,
  ): WormholeMessageId {
    const unsignedVaa = CosmwasmWormholeCore.parseWormholeMessage(chain, coreAddress, tx);

    return {
      chain: unsignedVaa.emitterChain,
      emitter: unsignedVaa.emitterAddress,
      sequence: unsignedVaa.sequence,
    };
  }
}
