import type {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  SignedTx,
  StaticPlatformMethods,
  TokenId,
  TxHash,
} from '@wormhole-foundation/sdk-connect';
import {
  PlatformContext,
  Wormhole,
  chainToPlatform,
  decimals,
  encoding,
  isNative,
  nativeChainIds,
  networkPlatformConfigs,
} from '@wormhole-foundation/sdk-connect';

import type { Provider } from 'ethers';
import { JsonRpcProvider } from 'ethers';
import * as ethers_contracts from './ethers-contracts/index.js';

import { EvmAddress, EvmZeroAddress } from './address.js';
import { EvmChain } from './chain.js';
import type {
  AnyEvmAddress,
  EvmChains,
  EvmPlatformType,
  IndexerAPIKeys,
} from './types.js';
import { _platform } from './types.js';
import { AlchemyClient, GoldRushClient } from './indexer.js';

/**
 * @category EVM
 */
export class EvmPlatform<N extends Network>
  extends PlatformContext<N, EvmPlatformType>
  implements StaticPlatformMethods<EvmPlatformType, typeof EvmPlatform>
{
  static _platform = _platform;
  private _providers: Partial<Record<EvmChains, JsonRpcProvider | undefined>> =
    {};

  constructor(network: N, _config?: ChainsConfig<N, EvmPlatformType>) {
    super(
      network,
      _config ?? networkPlatformConfigs(network, EvmPlatform._platform),
    );
  }

  getRpc<C extends EvmChains>(chain: C): Provider {
    const cachedProvider = this._providers[chain];
    if (cachedProvider) {
      return cachedProvider;
    }

    if (chain in this.config && this.config[chain]!.rpc) {
      const provider = new JsonRpcProvider(
        this.config[chain]!.rpc,
        nativeChainIds.networkChainToNativeChainId.get(this.network, chain),
        {
          staticNetwork: true,
        },
      );
      this._providers[chain] = provider;
      return provider;
    } else {
      throw new Error('No configuration available for chain: ' + chain);
    }
  }

  getChain<C extends EvmChains>(chain: C, rpc?: Provider): EvmChain<N, C> {
    if (chain in this.config) return new EvmChain<N, C>(chain, this, rpc);
    throw new Error('No configuration available for chain: ' + chain);
  }

  static nativeTokenId<N extends Network, C extends EvmChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    if (!EvmPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for EVM: ${chain}`);
    return Wormhole.tokenId(chain, EvmZeroAddress);
  }

  static isNativeTokenId<N extends Network, C extends EvmChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!EvmPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === EvmZeroAddress;
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === EvmPlatform._platform;
  }

  static async getDecimals(
    _network: Network,
    _chain: Chain,
    rpc: Provider,
    token: AnyEvmAddress,
  ): Promise<number> {
    if (isNative(token)) return decimals.nativeDecimals(EvmPlatform._platform);

    const tokenContract = EvmPlatform.getTokenImplementation(
      rpc,
      new EvmAddress(token).toString(),
    );
    return Number(await tokenContract.decimals());
  }

  static async getBalance(
    _network: Network,
    _chain: Chain,
    rpc: Provider,
    walletAddr: string,
    token: AnyEvmAddress,
  ): Promise<bigint | null> {
    if (isNative(token)) return rpc.getBalance(walletAddr);

    const tokenImpl = EvmPlatform.getTokenImplementation(
      rpc,
      new EvmAddress(token).toString(),
    );
    return tokenImpl.balanceOf(walletAddr);
  }

  static async getBalances(
    network: Network,
    chain: Chain,
    rpc: Provider,
    walletAddr: string,
    indexers?: IndexerAPIKeys,
    signal?: AbortSignal,
  ): Promise<Balances> {
    if (!indexers) {
      throw new Error(
        `Can't get all EVM balances without an indexer. Use getBalance to make individual calls instead.`,
      );
    }

    // Helper to create a timeout promise with abort support
    const withTimeout = <T>(
      promise: Promise<T>,
      ms: number,
      name: string,
    ): Promise<T> => {
      if (signal?.aborted) throw new Error('Request aborted');

      return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(
            () => reject(new Error(`${name} timeout after ${ms}ms`)),
            ms,
          );
          signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Request aborted'));
          });
        }),
      ]);
    };

    // Helper to try a provider with timeout
    const tryProvider = async (
      provider: GoldRushClient | AlchemyClient,
      name: string,
      timeoutMs: number,
    ): Promise<Balances | null> => {
      try {
        if (!provider.supportsChain(network, chain)) {
          console.error(
            `Network=${network} Chain=${chain} not supported by ${name} indexer API`,
          );
          return null;
        }

        const balances = await withTimeout(
          provider.getBalances(network, chain, walletAddr, signal),
          timeoutMs,
          name,
        );

        // Ensure native balance is always included
        balances['native'] ??= await rpc.getBalance(walletAddr);
        return balances;
      } catch (e) {
        console.error(`Error querying ${name} indexer API: ${e}`);
        return null;
      }
    };

    // Try providers in order with their respective timeouts
    const providers: Array<
      [string, GoldRushClient | AlchemyClient | null, number]
    > = [
      [
        'Gold Rush',
        indexers.goldRush ? new GoldRushClient(indexers.goldRush) : null,
        3000,
      ],
      [
        'Alchemy',
        indexers.alchemy ? new AlchemyClient(indexers.alchemy) : null,
        5000,
      ],
    ];

    for (const [name, provider, timeout] of providers) {
      if (!provider) continue;
      const result = await tryProvider(provider, name, timeout);
      if (result) return result;
    }

    throw new Error(`Failed to get a successful response from an EVM indexer`);
  }

  static async sendWait(
    chain: Chain,
    rpc: Provider,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    for (const stxn of stxns) {
      const txRes = await rpc.broadcastTransaction(stxn);
      txhashes.push(txRes.hash);

      if (chain === 'Celo') {
        console.error('TODO: override celo block fetching');
        continue;
      }

      // Wait for confirmation
      const txReceipt = await txRes.wait();
      if (txReceipt === null) throw new Error('Received null TxReceipt');
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: Provider): Promise<number> {
    return await rpc.getBlockNumber();
  }
  static async getLatestFinalizedBlock(rpc: Provider): Promise<number> {
    const block = await rpc.getBlock('finalized');
    if (!block) throw new Error('Could not get finalized block');
    return block?.number;
  }

  // Look up the Wormhole Canonical Network and Chain from the EVM chainId
  static chainFromChainId(eip155ChainId: string): [Network, EvmChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      EvmPlatform._platform,
      BigInt(eip155ChainId),
    );

    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${eip155ChainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(rpc: Provider): Promise<[Network, EvmChains]> {
    const { chainId } = await rpc.getNetwork();
    return EvmPlatform.chainFromChainId(encoding.bignum.encode(chainId, true));
  }

  static getTokenImplementation(
    connection: Provider,
    address: string,
  ): ethers_contracts.TokenImplementation {
    const ti = ethers_contracts.TokenImplementation__factory.connect(
      address,
      connection,
    );
    if (!ti)
      throw new Error(`No token implementation available for: ${address}`);
    return ti;
  }
}
