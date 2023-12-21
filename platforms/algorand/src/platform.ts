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

import { Algodv2 } from "algosdk";
import { AlgorandChain } from "./chain";
import { AlgorandChains, AlgorandPlatformType, AnyAlgorandAddress, _platform } from "./types";

/**
 * @category Algorand
 */

export class AlgorandPlatform<N extends Network> extends PlatformContext<N, AlgorandPlatformType> {
  static _platform: AlgorandPlatformType = _platform;

  constructor(network: N, _config?: ChainsConfig<N, AlgorandPlatformType>) {
    super(network, _config ?? networkPlatformConfigs(network, AlgorandPlatform._platform));
  }

  getRpc<C extends AlgorandChains>(chain: C): Algodv2 {
    if (chain in this.config) return new Algodv2("", this.config[chain]!.rpc);
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends AlgorandChains>(chain: C): AlgorandChain<N, C> {
    if (chain in this.config) return new AlgorandChain<N, C>(chain, this);
    throw new Error("No configuration available for chain: " + chain);
  }

  async parseTransaction<C extends AlgorandChains>(
    chain: C,
    rpc: Algodv2,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const wc: WormholeCore<N, AlgorandPlatformType, C> = await this.getProtocol(
      "WormholeCore",
      rpc,
    );
    return wc.parseTransaction(txid);
  }

  static nativeTokenId<N extends Network, C extends AlgorandChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    if (!AlgorandPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for ${_platform}: ${chain}`);
    throw new Error("Not implemented");
  }

  static isNativeTokenId<N extends Network, C extends AlgorandChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!AlgorandPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    throw new Error("Not implemented");
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === AlgorandPlatform._platform;
  }

  static async getDecimals(
    chain: Chain,
    rpc: Algodv2,
    token: AnyAlgorandAddress | "native",
  ): Promise<bigint> {
    throw new Error("Not implemented");
  }

  static async getBalance(
    chain: Chain,
    rpc: Algodv2,
    walletAddr: string,
    token: AnyAlgorandAddress | "native",
  ): Promise<bigint | null> {
    throw new Error("Not  implemented");
  }

  static async getBalances(
    chain: Chain,
    rpc: Algodv2,
    walletAddr: string,
    tokens: (AnyAlgorandAddress | "native")[],
  ): Promise<Balances> {
    throw new Error("Not implemented");
  }

  static async sendWait(chain: Chain, rpc: Algodv2, stxns: SignedTx[]): Promise<TxHash[]> {
    throw new Error("Not implemented");
  }

  static async getLatestBlock(rpc: Algodv2): Promise<number> {
    throw new Error("Not implemented");
  }
  static async getLatestFinalizedBlock(rpc: Algodv2): Promise<number> {
    throw new Error("Not implemented");
  }

  static chainFromChainId(genesisHash: string): [Network, AlgorandChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      AlgorandPlatform._platform,
      // @ts-ignore
      genesisHash,
    );

    if (networkChainPair === undefined) throw new Error(`Unknown native chain id ${genesisHash}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(rpc: Algodv2): Promise<[Network, AlgorandChains]> {
    throw new Error("Not implemented");
  }

  static getProtocolInitializer<PN extends ProtocolName>(
    protocol: PN,
  ): ProtocolInitializer<AlgorandPlatformType, PN> {
    return getProtocolInitializer(this._platform, protocol);
  }
}
