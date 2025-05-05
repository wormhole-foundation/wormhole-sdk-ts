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
import { Aptos, AptosConfig, Network as AptosNetwork } from "@aptos-labs/ts-sdk";
import { AptosChain } from "./chain.js";
import type { AptosChains, AptosPlatformType } from "./types.js";
import { _platform } from "./types.js";

import { APTOS_COIN } from "./constants.js";
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

  getRpc<C extends AptosChains>(chain: C): Aptos {
    if (chain in this.config) {
      const network = this.network === "Mainnet" ? AptosNetwork.MAINNET : AptosNetwork.TESTNET;
      const config = new AptosConfig({ fullnode: this.config[chain]!.rpc, network });
      return new Aptos(config);
    }
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends AptosChains>(chain: C, rpc?: Aptos): AptosChain<N, C> {
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

  static async getDecimals(network: Network, chain: Chain, rpc: Aptos, token: AnyAptosAddress): Promise<number> {
    if (isNative(token) || token === APTOS_COIN)
      return nativeDecimals.nativeDecimals(AptosPlatform._platform);

    const assetType = token.toString();
    const data = await rpc.getFungibleAssetMetadataByAssetType({ assetType });
    return data.decimals;
  }

  static async getBalance(
    network: Network,
    chain: Chain,
    rpc: Aptos,
    walletAddress: string,
    token: AnyAptosAddress,
  ): Promise<bigint | null> {
    const assetType = isNative(token) ? APTOS_COIN : token.toString();
    try {
      const data = await rpc.getCurrentFungibleAssetBalances({
        options: {
          where: {
            owner_address: { _eq: walletAddress },
            asset_type: { _eq: assetType },
          },
        },
      });
      return data[0]?.amount ?? null;
    } catch (e: any) {
      if (e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  static async getBalances(
    network: Network,
    chain: Chain,
    rpc: Aptos,
    walletAddress: string,
  ): Promise<Balances> {
    try {
      const data = await rpc.getCurrentFungibleAssetBalances({
        options: {
          where: {
            owner_address: { _eq: walletAddress },
          },
        },
      });
      let balances: Balances = {};
      for (const bal of data) {
        if (bal.asset_type) {
          let addr = bal.asset_type === '0x1::aptos_coin::AptosCoin' ? 'native' : bal.asset_type;
          balances[addr] = bal.amount;
        }
      }
      return balances;
    } catch (e: any) {
      if (e.status === 404) {
        return {};
      }
      throw e;
    }
  }

  static async sendWait(chain: Chain, rpc: Aptos, stxns: SignedTx[]): Promise<TxHash[]> {
    const txhashes = [];
    for (const stxn of stxns) {
      const pendingTx = await rpc.transaction.submit.simple(stxn.transaction);
      const res = await rpc.waitForTransaction({
        transactionHash: pendingTx.hash,
      });
      txhashes.push(res.hash);
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: Aptos): Promise<number> {
    const li = await rpc.getLedgerInfo();
    return Number(li.block_height);
  }

  static async getLatestFinalizedBlock(rpc: Aptos): Promise<number> {
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

  static async chainFromRpc(rpc: Aptos): Promise<[Network, AptosChains]> {
    const li = await rpc.getLedgerInfo();
    return this.chainFromChainId(li.chain_id.toString());
  }
}
