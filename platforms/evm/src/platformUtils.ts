import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  toNative,
  Network,
  PlatformToChains,
} from '@wormhole-foundation/connect-sdk';

import { Provider } from 'ethers';
import { evmChainIdToNetworkChainPair } from './constants';
import { EvmAddress, EvmZeroAddress } from './address';
import { EvmContracts } from './contracts';

const EVM_NATIVE_DECIMALS = 18;

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmUtils {
  export async function getDecimals(
    chain: ChainName,
    rpc: Provider,
    tokenAddress: EvmAddress,
  ): Promise<bigint> {
    if (tokenAddress.toString() === EvmZeroAddress) return BigInt(EVM_NATIVE_DECIMALS);

    const tokenContract = EvmContracts.getTokenImplementation(
      rpc,
      tokenAddress.toString(),
    );
    const decimals = await tokenContract.decimals();
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Provider,
    walletAddr: string,
    tokenAddress: EvmAddress,
  ): Promise<bigint | null> {
    if (tokenAddress.toString() === EvmZeroAddress) return await rpc.getBalance(walletAddr);

    const token = EvmContracts.getTokenImplementation(rpc, tokenAddress.toString());
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
  ): Promise<[Network, PlatformToChains<'Evm'>]> {
    const { chainId } = await rpc.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);
    const [network, chain] = networkChainPair;
    return [network, chain];
  }
}
