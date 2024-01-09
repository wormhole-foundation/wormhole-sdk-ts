import { Chain, Network, PlatformContext, Wormhole } from "@wormhole-foundation/connect-sdk";
import { AptosClient } from "aptos";
import { AptosChain } from "./chain";
import { AptosChains, AptosPlatformType, _platform } from "./types";

import {
  Balances,
  SignedTx,
  TokenId,
  TxHash,
  chainToPlatform,
  nativeChainIds,
  decimals as nativeDecimals,
} from "@wormhole-foundation/connect-sdk";
import { CoinClient, Types } from "aptos";
import { APTOS_COIN, APTOS_SEPARATOR } from "./constants";
import { AnyAptosAddress } from "./types";

/**
 * @category Aptos
 */
export class AptosPlatform<N extends Network> extends PlatformContext<N, AptosPlatformType> {
  static _platform = _platform;

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
    return Wormhole.chainAddress(chain, APTOS_COIN);
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

  static isSupportedChain<C extends AptosChains>(chain: C): boolean {
    const platform = chainToPlatform(chain);
    return platform === AptosPlatform._platform;
  }

  static async getDecimals(
    chain: Chain,
    rpc: AptosClient,
    token: AnyAptosAddress | "native",
  ): Promise<bigint> {
    if (token === "native") return BigInt(nativeDecimals.nativeDecimals(AptosPlatform._platform));

    const tokenAddr = token.toString();
    const coinType = `0x1::coin::CoinInfo<${tokenAddr}>`;
    const decimals = (
      (await rpc.getAccountResource(tokenAddr.split(APTOS_SEPARATOR)[0], coinType)).data as any
    ).decimals;

    return decimals;
  }

  static async getBalance(
    chain: Chain,
    rpc: AptosClient,
    walletAddress: string,
    token: AnyAptosAddress | "native",
  ): Promise<bigint | null> {
    const tokenAddress = token === "native" ? APTOS_COIN : token.toString();
    const cc = new CoinClient(rpc);
    try {
      const balance = await cc.checkBalance(walletAddress, {
        coinType: tokenAddress,
      });
      return balance;
    } catch (e: any) {
      if (
        (e instanceof Types.ApiError || e.errorCode === "resource_not_found") &&
        e.status === 404
      ) {
        return null;
      }
      throw e;
    }
  }

  static async getBalances(
    chain: Chain,
    rpc: AptosClient,
    walletAddress: string,
    tokens: (AnyAptosAddress | "native")[],
  ): Promise<Balances> {
    return {};
    // const tb = await AptosPlatform.getTokenBridge(rpc);
    // const addresses = await Promise.all(
    //   tokens.map((tokenId) => await tb.getOriginalAsset(tokenId)),
    // );

    // let coinBalances: CoinBalance[] = [];
    // let offset = 0;
    // const limit = 100;
    // while (true) {
    //   const result = await this.fetchCurrentCoins(walletAddress, offset, limit);
    //   coinBalances = [...coinBalances, ...result.data.current_coin_balances];
    //   if (result.data.current_coin_balances.length < limit) {
    //     break;
    //   }
    //   offset += result.data.current_coin_balances.length;
    // }

    // return addresses.map((address) =>
    //   !address
    //     ? null
    //     : BigNumber.from(
    //       coinBalances.find((bal) => bal.coin_type === address)?.amount || 0,
    //     ),
    // );
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

  static chainFromChainId(chainId: number): [Network, AptosChains] {
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
    return this.chainFromChainId(ci);
  }
}
