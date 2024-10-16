import type {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  SignedTx,
  StaticPlatformMethods,
  TokenId,
  TxHash,
} from "@wormhole-foundation/sdk-connect";
import {
  PlatformContext,
  Wormhole,
  chainToPlatform,
  isNative,
  nativeChainIds,
  decimals as nativeDecimals,
  networkPlatformConfigs,
} from "@wormhole-foundation/sdk-connect";

import { PaginatedCoins, SuiClient } from "@mysten/sui.js/client";
import { SuiAddress } from "./address.js";
import { SuiChain } from "./chain.js";
import { SUI_COIN } from "./constants.js";
import type { AnySuiAddress, SuiChains, SuiPlatformType } from "./types.js";
import { _platform } from "./types.js";
import { getObjectFields } from "./utils.js";

/**
 * @category Sui
 */

export class SuiPlatform<N extends Network>
  extends PlatformContext<N, SuiPlatformType>
  implements StaticPlatformMethods<SuiPlatformType, typeof SuiPlatform>
{
  static _platform = _platform;

  constructor(network: N, _config?: ChainsConfig<N, SuiPlatformType>) {
    super(network, _config ?? networkPlatformConfigs(network, SuiPlatform._platform));
  }

  getRpc<C extends SuiChains>(chain: C): SuiClient {
    if (chain in this.config) return new SuiClient({ url: this.config[chain]!.rpc });
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends SuiChains>(chain: C): SuiChain<N, C> {
    if (chain in this.config) return new SuiChain<N, C>(chain, this);
    throw new Error("No configuration available for chain: " + chain);
  }

  static nativeTokenId<N extends Network, C extends SuiChains>(network: N, chain: C): TokenId<C> {
    if (!SuiPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for ${_platform}: ${chain}`);
    return Wormhole.tokenId(chain, SUI_COIN);
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

  static async getDecimals(chain: Chain, rpc: SuiClient, token: AnySuiAddress): Promise<number> {
    if (isNative(token)) return nativeDecimals.nativeDecimals(SuiPlatform._platform);

    const parsedAddress = new SuiAddress(token);

    try {
      const fields = await getObjectFields(rpc, parsedAddress.toString());
      if (fields && "decimals" in fields) return fields["decimals"];
    } catch {}

    const metadata = await rpc.getCoinMetadata({ coinType: parsedAddress.toString() });
    if (metadata === null)
      throw new Error(`Can't fetch decimals for token ${parsedAddress.toString()}`);

    return metadata.decimals;
  }

  static async getCoins(connection: SuiClient, account: AnySuiAddress, coinType: string) {
    let coins: { coinType: string; coinObjectId: string }[] = [];
    let cursor: string | null = null;
    const owner = new SuiAddress(account).toString();
    do {
      const result: PaginatedCoins = await connection.getCoins({
        owner,
        coinType,
        cursor,
      });
      coins = [...coins, ...result.data];
      cursor = result.hasNextPage ? result.nextCursor! : null;
    } while (cursor);
    return coins;
  }

  static async getBalance(
    chain: Chain,
    rpc: SuiClient,
    walletAddr: string,
    token: AnySuiAddress,
  ): Promise<bigint | null> {
    if (isNative(token)) {
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
    rpc: SuiClient,
    walletAddr: string,
    tokens: AnySuiAddress[],
  ): Promise<Balances> {
    const balancesArr = await Promise.all(
      tokens.map(async (token) => {
        const balance = await this.getBalance(chain, rpc, walletAddr, token);
        const address = isNative(token) ? "native" : new SuiAddress(token).toString();
        return { [address]: balance };
      }),
    );
    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  static async sendWait(chain: Chain, rpc: SuiClient, stxns: SignedTx[]): Promise<TxHash[]> {
    const txhashes = [];
    for (const stxn of stxns) {
      const pendingTx = await rpc.executeTransactionBlock(stxn);
      await rpc.waitForTransactionBlock({ digest: pendingTx.digest });
      txhashes.push(pendingTx.digest);
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: SuiClient): Promise<number> {
    return Number(await rpc.getLatestCheckpointSequenceNumber());
  }
  static async getLatestFinalizedBlock(rpc: SuiClient): Promise<number> {
    return this.getLatestBlock(rpc);
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

  static async chainFromRpc(rpc: SuiClient): Promise<[Network, SuiChains]> {
    const result = await rpc.call("sui_getChainIdentifier", []);
    return this.chainFromChainId(result as string);
  }
}
