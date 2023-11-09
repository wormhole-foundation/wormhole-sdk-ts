import {
  Balances,
  ChainName,
  Network,
  PlatformToChains,
  RpcConnection,
  SignedTx,
  TokenId,
  TxHash,
  canonicalChainIds,
  chainToPlatform,
  nativeChainAddress,
  nativeDecimals,
} from "@wormhole-foundation/connect-sdk";
import { AptosClient, CoinClient, Types } from "aptos";
import { APTOS_COIN, APTOS_SEPARATOR } from "./constants";
import { AptosPlatform } from "./platform";
import { AnyAptosAddress } from "./types";

/**
 * @category Aptos
 */
// Provides runtime concrete value
export module AptosUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain)) throw new Error(`invalid chain: ${chain}`);
    return nativeChainAddress([chain, APTOS_COIN]);
  }

  export function isSupportedChain(chain: ChainName): boolean {
    const platform = chainToPlatform(chain);
    return platform === AptosPlatform.platform;
  }

  export function isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = nativeTokenId(chain);
    return native == tokenId;
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: AptosClient,
    token: AnyAptosAddress | "native",
  ): Promise<bigint> {
    if (token === "native") return nativeDecimals(AptosPlatform.platform);

    const tokenAddr = token.toString()
    const coinType = `0x1::coin::CoinInfo<${tokenAddr}>`;
    const decimals = (
      (
        await rpc.getAccountResource(
          tokenAddr.split(APTOS_SEPARATOR)[0],
          coinType,
        )
      ).data as any
    ).decimals;

    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
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

  export async function getBalances(
    chain: ChainName,
    rpc: AptosClient,
    walletAddress: string,
    tokens: (AnyAptosAddress | "native")[],
  ): Promise<Balances> {
    return {}
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

  export async function sendWait(
    chain: ChainName,
    rpc: AptosClient,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    // TODO: concurrent
    const txhashes = []
    for (const stxn of stxns) {
      const pendingTx = await rpc.submitTransaction(stxn)
      const res = await rpc.waitForTransactionWithResult(pendingTx.hash);
      txhashes.push(res.hash);
    }
    return txhashes;
  }

  export async function getCurrentBlock(rpc: AptosClient): Promise<number> {
    const li = await rpc.getLedgerInfo()
    return Number(li.block_height)
  }

  export function chainFromChainId(
    genesisHash: string,
  ): [Network, PlatformToChains<AptosPlatform.Type>] {
    const netChain = canonicalChainIds.getNetworkAndChainName(AptosPlatform.platform, genesisHash);

    if (!netChain)
      throw new Error(`No matching genesis hash to determine network and chain: ${genesisHash}`);

    const [network, chain] = netChain;
    return [network, chain];
  }

  export async function chainFromRpc(
    rpc: RpcConnection<AptosPlatform.Type>,
  ): Promise<[Network, PlatformToChains<AptosPlatform.Type>]> {
    const conn = rpc as AptosClient;
    const ci = await conn.getChainId();
    return chainFromChainId(ci.toString());
  }
}
