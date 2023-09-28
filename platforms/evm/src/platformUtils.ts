import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  Network,
  PlatformToChains,
  nativeDecimals,
} from '@wormhole-foundation/connect-sdk';

import { Provider } from 'ethers';
import { evmChainIdToNetworkChainPair } from './constants';
import { EvmAddress, EvmZeroAddress } from './address';
import { EvmContracts } from './contracts';
import { EvmPlatform } from './platform';

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmUtils {
  export async function getDecimals(
    chain: ChainName,
    rpc: Provider,
    tokenId: TokenId | 'native',
  ): Promise<bigint> {
    if (tokenId === 'native') return nativeDecimals(EvmPlatform.platform);

    const tokenContract = EvmContracts.getTokenImplementation(
      rpc,
      tokenId.address.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Provider,
    walletAddr: string,
    tokenId: TokenId | 'native',
  ): Promise<bigint | null> {
    if (tokenId === 'native') return await rpc.getBalance(walletAddr);

    const token = EvmContracts.getTokenImplementation(
      rpc,
      tokenId.address.toString(),
    );
    const balance = await token.balanceOf(walletAddr);
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
