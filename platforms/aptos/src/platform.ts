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
import { AptosClient } from "aptos";
import { AptosChain } from "./chain.js";
import type { AptosChains, AptosPlatformType } from "./types.js";
import { _platform } from "./types.js";

import { CoinClient } from "aptos";
import { AptosAddress } from "./address.js";
import { APTOS_COIN, APTOS_SEPARATOR } from "./constants.js";
import type { AnyAptosAddress } from "./types.js";

/**
 * @category Aptos
 */
export class AptosPlatform<N extends Network>
  extends PlatformContext<N, AptosPlatformType>
  implements StaticPlatformMethods<AptosPlatformType, typeof AptosPlatform>
{
  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, AptosPlatformType>) {
    super(network, config ?? networkPlatformConfigs(network, AptosPlatform._platform));
  }

  getRpc<C extends AptosChains>(chain: C): AptosClient {
    if (chain in this.config) return new AptosClient(this.config[chain]!.rpc);
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends AptosChains>(chain: C, rpc?: AptosClient): AptosChain<N, C> {
    if (chain in this.config) return new AptosChain(chain, this);
    throw new Error("No configuration available for chain: " + chain);
  }

  static nativeTokenId<N extends Network, C extends AptosChains>(network: N, chain: C): TokenId<C> {
    if (!this.isSupportedChain(chain)) throw new Error(`invalid chain: ${chain}`);
    return Wormhole.tokenId(chain, APTOS_COIN);
  }

  static isNativeTokenId<N extends Network, C extends AptosChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!this.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = this.nativeTokenId(network, chain);
    return native == tokenId;
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === AptosPlatform._platform;
  }

  static async getDecimals(
    chain: Chain,
    rpc: AptosClient,
    token: AnyAptosAddress,
  ): Promise<number> {
    if (isNative(token)) return nativeDecimals.nativeDecimals(AptosPlatform._platform);

    const tokenAddr = token.toString();
    const coinType = `0x1::coin::CoinInfo<${tokenAddr}>`;
    const decimals = (
      (await rpc.getAccountResource(tokenAddr.split(APTOS_SEPARATOR)[0]!, coinType)).data as any
    ).decimals;

    return decimals;
  }

  static async getBalance(
    chain: Chain,
    rpc: AptosClient,
    walletAddress: string,
    token: AnyAptosAddress,
  ): Promise<bigint | null> {
    const tokenAddress = isNative(token) ? APTOS_COIN : token.toString();
    const cc = new CoinClient(rpc);
    try {
      const balance = await cc.checkBalance(walletAddress, {
        coinType: tokenAddress,
      });
      return balance;
    } catch (e: any) {
      if (e.errorCode === "resource_not_found" && e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  static async getBalances(
    chain: Chain,
    rpc: AptosClient,
    walletAddress: string,
    tokens: AnyAptosAddress[],
  ): Promise<Balances> {
    const balancesArr = await Promise.all(
      tokens.map(async (token) => {
        const balance = await this.getBalance(chain, rpc, walletAddress, token);
        const address = isNative(token) ? "native" : new AptosAddress(token).toString();
        return { [address]: balance };
      }),
    );
    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  static async sendWait(chain: Chain, rpc: AptosClient, stxns: SignedTx[]): Promise<TxHash[]> {
    // TODO: concurrent
    const txhashes = [];
    for (const stxn of stxns) {
      const pendingTx = await rpc.submitTransaction(stxn);
      const res = await rpc.waitForTransactionWithResult(pendingTx.hash);
      txhashes.push(res.hash);
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: AptosClient): Promise<number> {
    const li = await rpc.getLedgerInfo();
    return Number(li.block_height);
  }

  static async getLatestFinalizedBlock(rpc: AptosClient): Promise<number> {
    const li = await rpc.getLedgerInfo();
    return Number(li.block_height);
  }

  static chainFromChainId(chainId: string | bigint): [Network, AptosChains] {
    const netChain = nativeChainIds.platformNativeChainIdToNetworkChain(
      AptosPlatform._platform,
      BigInt(chainId),
    );

    if (!netChain)
      throw new Error(`No matching chainId to determine network and chain: ${chainId}`);

    const [network, chain] = netChain;
    return [network, chain];
  }

  static async chainFromRpc(rpc: AptosClient): Promise<[Network, AptosChains]> {
    const conn = rpc as AptosClient;
    const ci = await conn.getChainId();
    return this.chainFromChainId(ci.toString());
  }
}
