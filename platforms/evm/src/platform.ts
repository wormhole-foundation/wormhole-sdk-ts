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
import type { AnyEvmAddress, EvmChains, EvmPlatformType } from './types.js';
import { _platform } from './types.js';

/**
 * @category EVM
 */
export class EvmPlatform<N extends Network>
  extends PlatformContext<N, EvmPlatformType>
  implements StaticPlatformMethods<EvmPlatformType, typeof EvmPlatform>
{
  static _platform = _platform;

  constructor(network: N, _config?: ChainsConfig<N, EvmPlatformType>) {
    super(
      network,
      _config ?? networkPlatformConfigs(network, EvmPlatform._platform),
    );
  }

  getRpc<C extends EvmChains>(chain: C): Provider {
    if (chain in this.config && this.config[chain]!.rpc)
      return new JsonRpcProvider(this.config[chain]!.rpc);
    throw new Error('No configuration available for chain: ' + chain);
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
    chain: Chain,
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
    chain: Chain,
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
    chain: Chain,
    rpc: Provider,
    walletAddr: string,
    tokens: AnyEvmAddress[],
  ): Promise<Balances> {
    const balancesArr = await Promise.all(
      tokens.map(async (token) => {
        const balance = await this.getBalance(chain, rpc, walletAddr, token);
        const address = isNative(token)
          ? 'native'
          : new EvmAddress(token).toString();
        return { [address]: balance };
      }),
    );
    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
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
