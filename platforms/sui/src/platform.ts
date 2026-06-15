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
  encoding,
  isNative,
  nativeChainIds,
  decimals as nativeDecimals,
  networkPlatformConfigs,
} from "@wormhole-foundation/sdk-connect";

import { SuiGrpcClient, type SuiGrpcClientOptions } from "@mysten/sui/grpc";
import { fromBase58 } from "@mysten/sui/utils";
import { SuiAddress, unwrapCoinType } from "./address.js";
import { SuiChain } from "./chain.js";
import { SUI_COIN } from "./constants.js";
import type { AnySuiAddress, SuiChains, SuiPlatformType } from "./types.js";
import { _platform, isSameType } from "./types.js";
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

  getRpc<C extends SuiChains>(chain: C): SuiGrpcClient {
    if (chain in this.config) {
      const chainConfig = this.config[chain]!;
      // v2 uses the gRPC client; `network` is required. Wormhole networks
      // ("Mainnet" | "Testnet" | "Devnet") lowercase to the Sui network names.
      const network = this.network.toLowerCase();
      const options: SuiGrpcClientOptions = chainConfig.httpHeaders
        ? { network, baseUrl: chainConfig.rpc, meta: chainConfig.httpHeaders }
        : { network, baseUrl: chainConfig.rpc };
      return new SuiGrpcClient(options);
    }
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

  static async getDecimals(
    network: Network,
    chain: Chain,
    rpc: SuiGrpcClient,
    token: AnySuiAddress,
  ): Promise<number> {
    if (isNative(token)) return nativeDecimals.nativeDecimals(SuiPlatform._platform);

    const parsedAddress = new SuiAddress(token);

    try {
      const fields = await getObjectFields(rpc, parsedAddress.toString());
      if (fields && "decimals" in fields) return Number(fields["decimals"]);
    } catch {}

    const { coinMetadata } = await rpc.getCoinMetadata({ coinType: parsedAddress.toString() });
    if (coinMetadata === null)
      throw new Error(`Can't fetch decimals for token ${parsedAddress.toString()}`);

    return coinMetadata.decimals;
  }

  static async getCoins(connection: SuiGrpcClient, account: AnySuiAddress, coinType: string) {
    let coins: { coinType: string; coinObjectId: string }[] = [];
    let cursor: string | null = null;
    const owner = new SuiAddress(account).toString();
    do {
      const result = await connection.listCoins({ owner, coinType, cursor });
      coins = [
        ...coins,
        ...result.objects.map((c) => ({ coinType: unwrapCoinType(c.type), coinObjectId: c.objectId })),
      ];
      cursor = result.hasNextPage ? result.cursor : null;
    } while (cursor);
    return coins;
  }

  static async getBalance(
    _network: Network,
    _chain: Chain,
    rpc: SuiGrpcClient,
    walletAddr: string,
    token: AnySuiAddress,
  ): Promise<bigint | null> {
    const { balance } = isNative(token)
      ? await rpc.getBalance({ owner: walletAddr })
      : await rpc.getBalance({ owner: walletAddr, coinType: token.toString() });
    return BigInt(balance.balance);
  }

  static async getBalances(
    _network: Network,
    _chain: Chain,
    rpc: SuiGrpcClient,
    walletAddr: string,
  ): Promise<Balances> {
    const balances: Balances = {};
    let cursor: string | null = null;
    do {
      const result = await rpc.listBalances({ owner: walletAddr, cursor });
      for (const { coinType, balance } of result.balances) {
        // gRPC returns the full-padded coin type (0x0000…0002::sui::SUI), so
        // compare via isSameType rather than strict-equality with the short SUI_COIN.
        const address = isSameType(coinType, SUI_COIN) ? "native" : coinType;
        balances[address] = BigInt(balance);
      }
      cursor = result.hasNextPage ? result.cursor : null;
    } while (cursor);
    return balances;
  }

  static async sendWait(chain: Chain, rpc: SuiGrpcClient, stxns: SignedTx[]): Promise<TxHash[]> {
    const txhashes = [];
    for (const stxn of stxns) {
      const result = await rpc.executeTransaction(stxn);
      const digest = (result.Transaction ?? result.FailedTransaction)!.digest;
      await rpc.waitForTransaction({ digest });
      txhashes.push(digest);
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: SuiGrpcClient): Promise<number> {
    const { response } = await rpc.ledgerService.getServiceInfo({});
    return Number(response.checkpointHeight ?? 0n);
  }
  static async getLatestFinalizedBlock(rpc: SuiGrpcClient): Promise<number> {
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

  static async chainFromRpc(rpc: SuiGrpcClient): Promise<[Network, SuiChains]> {
    // gRPC returns the base58-encoded genesis checkpoint digest; the Sui chain identifier
    // (as registered in nativeChainIds) is the hex of its first 4 bytes.
    const { chainIdentifier } = await rpc.core.getChainIdentifier();
    const chainId = encoding.hex.encode(fromBase58(chainIdentifier).slice(0, 4));
    return this.chainFromChainId(chainId);
  }
}
