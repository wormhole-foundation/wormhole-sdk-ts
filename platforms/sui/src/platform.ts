import {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  PlatformContext,
  SignedTx,
  TokenId,
  TxHash,
  chainToPlatform,
  nativeChainIds,
  networkPlatformConfigs,
  decimals as nativeDecimals,
  StaticPlatformMethods,
} from "@wormhole-foundation/connect-sdk";

import { Connection, JsonRpcProvider } from "@mysten/sui.js";
import { SuiChain } from "./chain";
import { AnySuiAddress, SuiChains, SuiPlatformType, _platform } from "./types";

/**
 * @category Sui
 */

export class SuiPlatform<N extends Network>
  extends PlatformContext<N, SuiPlatformType>
  implements StaticPlatformMethods<SuiPlatformType, typeof SuiPlatform>
{
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
    const native = this.nativeTokenId(network, chain);
    return native === tokenId;
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === SuiPlatform._platform;
  }

  static async getDecimals(
    chain: Chain,
    rpc: JsonRpcProvider,
    token: AnySuiAddress | "native",
  ): Promise<number> {
    if (token === "native") return nativeDecimals.nativeDecimals(SuiPlatform._platform);

    const tokenAddress = token.toString();
    const metadata = await rpc.getCoinMetadata({
      coinType: tokenAddress,
    });

    if (metadata === null) throw new Error(`Can't fetch decimals for token ${tokenAddress}`);

    return metadata.decimals;
  }

  static async getBalance(
    chain: Chain,
    rpc: JsonRpcProvider,
    walletAddr: string,
    token: AnySuiAddress | "native",
  ): Promise<bigint | null> {
    if (token === "native") {
      const { totalBalance } = await rpc.getBalance({
        owner: walletAddr,
      });
      return BigInt(totalBalance);
    }

    const { totalBalance } = await rpc.getBalance({
      owner: walletAddr,
      coinType: token.toString(),
    });
    return BigInt(totalBalance);
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
    const txhashes = [];
    for (const stxn of stxns) {
      const pendingTx = await rpc.executeTransactionBlock(stxn);
      await rpc.waitForTransactionBlock({ digest: pendingTx.digest });
      txhashes.push(pendingTx.digest);
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: JsonRpcProvider): Promise<number> {
    return Number(await rpc.getLatestCheckpointSequenceNumber());
  }
  static async getLatestFinalizedBlock(rpc: JsonRpcProvider): Promise<number> {
    throw new Error("Not implemented");
  }

  static chainFromChainId(chainId: string): [Network, SuiChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      SuiPlatform._platform,
      chainId,
    );

    if (networkChainPair === undefined) throw new Error(`Unknown native chain id ${chainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(rpc: JsonRpcProvider): Promise<[Network, SuiChains]> {
    const result = await rpc.call("sui_getChainIdentifier", []);
    return this.chainFromChainId(result);
  }
}
