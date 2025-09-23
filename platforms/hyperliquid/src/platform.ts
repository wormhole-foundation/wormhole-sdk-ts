import type {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  StaticPlatformMethods,
  TokenId,
  TxHash,
} from "@wormhole-foundation/sdk-connect";
import {
  PlatformContext,
  Wormhole,
  chainToPlatform,
  networkPlatformConfigs,
  nativeChainIds,
} from "@wormhole-foundation/sdk-connect";

import type { HyperliquidChains, HyperliquidPlatformType } from "./types.js";
import { _platform } from "./types.js";
import { HyperliquidChain } from "./chain.js";
import { HYPERLIQUID_ZERO_ADDRESS } from "./constants.js";

/**
 * @category Hyperliquid
 */

export class HyperliquidPlatform<N extends Network>
  extends PlatformContext<N, HyperliquidPlatformType>
  implements StaticPlatformMethods<HyperliquidPlatformType, typeof HyperliquidPlatform>
{
  static _platform = _platform;

  constructor(network: N, _config?: ChainsConfig<N, HyperliquidPlatformType>) {
    super(network, _config ?? networkPlatformConfigs(network, HyperliquidPlatform._platform));
  }

  getRpc<C extends HyperliquidChains>(chain: C): {} {
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends HyperliquidChains>(chain: C): HyperliquidChain<N, C> {
    if (chain in this.config) return new HyperliquidChain<N, C>(chain, this);
    throw new Error('No configuration available for chain: ' + chain);
  }

  static nativeTokenId<N extends Network, C extends HyperliquidChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    return Wormhole.tokenId(chain, HYPERLIQUID_ZERO_ADDRESS);
  }

  static isNativeTokenId<N extends Network, C extends HyperliquidChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!HyperliquidPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = this.nativeTokenId(network, chain);
    return native === tokenId;
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === HyperliquidPlatform._platform;
  }

  static async getDecimals(): Promise<number> {
    return 6;
  }

  static async getBalance(_network: Network, _chain: Chain): Promise<bigint | null> {
    return 0n;
  }

  static async getBalances(_network: Network, _chain: Chain): Promise<Balances> {
    const balances: Balances = {};
    return balances;
  }

  static async sendWait(): Promise<TxHash[]> {
    throw new Error("Method not implemented for hyperliquid");
  }

  static async getLatestBlock(): Promise<number> {
    throw new Error("Method not implemented for hyperliquid");
  }

  static async getLatestFinalizedBlock(): Promise<number> {
    throw new Error("Method not implemented for hyperliquid");
  }

  static chainFromChainId(chainId: string): [Network, HyperliquidChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      HyperliquidPlatform._platform,
      chainId,
    );

    if (networkChainPair === undefined) throw new Error(`Unknown Hyperliquid chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(): Promise<[Network, HyperliquidChains]> {
    return this.chainFromChainId("0x66eee");
  }
}
