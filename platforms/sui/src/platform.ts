import {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  PlatformContext,
  ProtocolInitializer,
  ProtocolName,
  SignedTx,
  TokenId,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  chainToPlatform,
  getProtocolInitializer,
  nativeChainIds,
  networkPlatformConfigs,
} from "@wormhole-foundation/connect-sdk";

import { Connection, JsonRpcProvider } from "@mysten/sui.js";
import { SuiChain } from "./chain";
import { AnySuiAddress, SuiChains, SuiPlatformType, _platform } from "./types";

/**
 * @category Sui
 */

export class SuiPlatform<N extends Network> extends PlatformContext<N, SuiPlatformType> {
  static _platform: SuiPlatformType = _platform;

  constructor(network: N, _config?: ChainsConfig<N, SuiPlatformType>) {
    super(network, _config ?? networkPlatformConfigs(network, SuiPlatform._platform));
  }

  getRpc<C extends SuiChains>(chain: C): JsonRpcProvider {
    if (chain in this.config)
      return new JsonRpcProvider(new Connection({ fullnode: this.config[chain]!.rpc }));
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends SuiChains>(chain: C): SuiChain<N, C> {
    if (chain in this.config) return new SuiChain<N, C>(chain, this);
    throw new Error("No configuration available for chain: " + chain);
  }

  async parseTransaction<C extends SuiChains>(
    chain: C,
    rpc: JsonRpcProvider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const wc: WormholeCore<N, SuiPlatformType, C> = await this.getProtocol("WormholeCore", rpc);
    return wc.parseTransaction(txid);
  }

  static nativeTokenId<N extends Network, C extends SuiChains>(network: N, chain: C): TokenId<C> {
    if (!SuiPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for ${_platform}: ${chain}`);
    throw new Error("Not implemented");
  }

  static isNativeTokenId<N extends Network, C extends SuiChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!SuiPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    throw new Error("Not implemented");
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === SuiPlatform._platform;
  }

  static async getDecimals(
    chain: Chain,
    rpc: JsonRpcProvider,
    token: AnySuiAddress | "native",
  ): Promise<bigint> {
    throw new Error("Not implemented");
  }

  static async getBalance(
    chain: Chain,
    rpc: JsonRpcProvider,
    walletAddr: string,
    token: AnySuiAddress | "native",
  ): Promise<bigint | null> {
    throw new Error("Not  implemented");
  }

  static async getBalances(
    chain: Chain,
    rpc: JsonRpcProvider,
    walletAddr: string,
    tokens: (AnySuiAddress | "native")[],
  ): Promise<Balances> {
    throw new Error("Not implemented");
  }

  static async sendWait(chain: Chain, rpc: JsonRpcProvider, stxns: SignedTx[]): Promise<TxHash[]> {
    throw new Error("Not implemented");
  }

  static async getLatestBlock(rpc: JsonRpcProvider): Promise<number> {
    throw new Error("Not implemented");
  }
  static async getLatestFinalizedBlock(rpc: JsonRpcProvider): Promise<number> {
    throw new Error("Not implemented");
  }

  static chainFromChainId(genesisHash: string): [Network, SuiChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      SuiPlatform._platform,
      genesisHash,
    );

    if (networkChainPair === undefined) throw new Error(`Unknown native chain id ${genesisHash}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(rpc: JsonRpcProvider): Promise<[Network, SuiChains]> {
    throw new Error("Not implemented");
  }

  static getProtocolInitializer<PN extends ProtocolName>(
    protocol: PN,
  ): ProtocolInitializer<SuiPlatformType, PN> {
    return getProtocolInitializer(this._platform, protocol);
  }
}
