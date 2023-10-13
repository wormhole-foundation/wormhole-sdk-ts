import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  Network,
  PlatformToChains,
  nativeDecimals,
  chainToPlatform,
  PlatformUtils,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';

import { Provider } from 'ethers';
import { evmChainIdToNetworkChainPair } from './constants';
import { EvmAddress, EvmZeroAddress } from './address';
import { EvmContracts } from './contracts';
import { EvmPlatform } from './platform';

// forces EvmUtils to implement PlatformUtils
var _: PlatformUtils<'Evm'> = EvmUtils;

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain))
      throw new Error(`invalid chain for EVM: ${chain}`);
    return {
      chain: chain,
      address: new EvmAddress(EvmZeroAddress) as any, // TODO: fix weird type error
    };
  }

  export function isSupportedChain(chain: ChainName): boolean {
    const platform = chainToPlatform(chain);
    return platform === EvmPlatform.platform;
  }

  export function isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === EvmZeroAddress;
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: Provider,
    token: UniversalOrNative<'Evm'> | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(EvmPlatform.platform);

    const tokenContract = EvmContracts.getTokenImplementation(
      rpc,
      token.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Provider,
    walletAddr: string,
    token: UniversalOrNative<'Evm'> | 'native',
  ): Promise<bigint | null> {
    if (token === 'native') return await rpc.getBalance(walletAddr);

    const tokenImpl = EvmContracts.getTokenImplementation(
      rpc,
      token.toString(),
    );
    const balance = await tokenImpl.balanceOf(walletAddr);
    return balance;
  }

  export async function sendWait(
    chain: ChainName,
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
      if (txReceipt === null) continue; // TODO: throw error?
    }
    return txhashes;
  }

  export async function getCurrentBlock(rpc: Provider): Promise<number> {
    return await rpc.getBlockNumber();
  }

  export async function chainFromRpc(
    rpc: Provider,
  ): Promise<[Network, PlatformToChains<EvmPlatform.Type>]> {
    const { chainId } = await rpc.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);
    const [network, chain] = networkChainPair;
    return [network, chain];
  }
}
