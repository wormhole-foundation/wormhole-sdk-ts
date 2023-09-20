import {
  ChainName,
  TokenId,
  TxHash,
  Platform,
  WormholeMessageId,
  SignedTx,
  AutomaticTokenBridge,
  TokenBridge,
  CircleBridge,
  AutomaticCircleBridge,
  ChainsConfig,
  toNative,
  NativeAddress,
  WormholeCore,
} from "@wormhole-foundation/connect-sdk";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmContracts } from "./contracts";
import { CosmwasmChain } from "./chain";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";

/**
 * @category Cosmwasm
 */
export class CosmwasmPlatform implements Platform<"Cosmwasm"> {
  // Provides runtime concrete value
  static _platform: "Cosmwasm" = "Cosmwasm";
  readonly platform = CosmwasmPlatform._platform;

  readonly conf: ChainsConfig;
  readonly contracts: CosmwasmContracts;

  constructor(conf: ChainsConfig) {
    this.conf = conf;
    this.contracts = new CosmwasmContracts(conf);
  }

  // @ts-ignore
  async getRpc(chain: ChainName): Promise<CosmWasmClient> {
    const rpcAddress = this.conf[chain]!.rpc;
    return CosmWasmClient.connect(rpcAddress);
  }

  getChain(chain: ChainName): CosmwasmChain {
    throw new Error("Not implemented");
    //return new CosmwasmChain(this, chain);
  }

  getWormholeCore(rpc: CosmWasmClient): Promise<WormholeCore<"Cosmwasm">> {
    throw new Error("Not implemented");
    //return CosmwasmWormholeCore.fromProvider(rpc, this.contracts);
  }

  async getTokenBridge(rpc: CosmWasmClient): Promise<TokenBridge<"Cosmwasm">> {
    return await CosmwasmTokenBridge.fromProvider(rpc, this.contracts);
  }
  async getAutomaticTokenBridge(
    rpc: CosmWasmClient
  ): Promise<AutomaticTokenBridge<"Cosmwasm">> {
    throw new Error("Not implemented");
    //return await CosmwasmAutomaticTokenBridge.fromProvider(rpc, this.contracts);
  }

  async getCircleBridge(
    rpc: CosmWasmClient
  ): Promise<CircleBridge<"Cosmwasm">> {
    throw new Error("Not implemented");
    //return await CosmwasmCircleBridge.fromProvider(rpc, this.contracts);
  }
  async getAutomaticCircleBridge(
    rpc: CosmWasmClient
  ): Promise<AutomaticCircleBridge<"Cosmwasm">> {
    throw new Error("Not implemented");
    //return await CosmwasmAutomaticCircleBridge.fromProvider(
    //  rpc,
    //  this.contracts
    //);
  }

  async getDecimals(
    chain: ChainName,
    rpc: CosmWasmClient,
    token: TokenId | "native"
  ): Promise<bigint> {
    throw new Error("Not implemented");
    // if (token === "native")
    //   return BigInt(this.conf[chain]!.nativeTokenDecimals);

    // const tokenContract = this.contracts.mustGetTokenImplementation(
    //   rpc,
    //   token.address.toString()
    // );
    // const decimals = await tokenContract.decimals();
    // return decimals;
  }

  async getBalance(
    chain: ChainName,
    rpc: CosmWasmClient,
    walletAddr: string,
    tokenId: TokenId | "native"
  ): Promise<bigint | null> {
    throw new Error("Not implemented");
    //if (tokenId === "native") return await rpc.getBalance(walletAddr);

    //const tb = await this.getTokenBridge(rpc);

    //const address = await tb.getWrappedAsset(tokenId);
    //if (!address) return null;

    //const token = this.contracts.mustGetTokenImplementation(
    //  rpc,
    //  address.toString()
    //);
    //const balance = await token.balanceOf(walletAddr);
    //return balance;
  }

  async sendWait(
    chain: ChainName,
    rpc: CosmWasmClient,
    stxns: SignedTx[]
  ): Promise<TxHash[]> {
    throw new Error("Not implemented");
    //const txhashes: TxHash[] = [];

    //for (const stxn of stxns) {
    //  const txRes = await rpc.broadcastTransaction(stxn);
    //  txhashes.push(txRes.hash);

    //  if (chain === "Celo") {
    //    console.error("TODO: override celo block fetching");
    //    continue;
    //  }

    //  // Wait for confirmation
    //  const txReceipt = await txRes.wait();
    //  if (txReceipt === null) continue; // TODO: throw error?
    //}
    //return txhashes;
  }

  parseAddress(chain: ChainName, address: string): NativeAddress<"Cosmwasm"> {
    return toNative(chain, address) as NativeAddress<"Cosmwasm">;
  }

  async parseTransaction(
    chain: ChainName,
    rpc: CosmWasmClient,
    txid: TxHash
  ): Promise<WormholeMessageId[]> {
    throw new Error("Not implemented");
    //const receipt = await rpc.getTransactionReceipt(txid);

    //if (receipt === null)
    //  throw new Error(`No transaction found with txid: ${txid}`);

    //const coreAddress = this.conf[chain]!.contracts.coreBridge;
    //const coreImpl = this.contracts.getCoreImplementationInterface();

    //return receipt.logs
    //  .filter((l: any) => {
    //    return l.address === coreAddress;
    //  })
    //  .map((log) => {
    //    const { topics, data } = log;
    //    const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
    //    if (parsed === null) return undefined;

    //    const emitterAddress = this.parseAddress(chain, parsed.args.sender);
    //    return {
    //      chain: chain,
    //      emitter: emitterAddress.toUniversalAddress(),
    //      sequence: parsed.args.sequence,
    //    } as WormholeMessageId;
    //  })
    //  .filter(isWormholeMessageId);
  }
}
