import {
  Chain,
  TokenId,
  TxHash,
  SignedTx,
  Network,
  PlatformToChains,
  nativeDecimals,
  chainToPlatform,
  Balances,
  encoding,
  nativeChainAddress,
  chainIds,
} from '@wormhole-foundation/connect-sdk';

import * as ethers_contracts from './ethers-contracts';

import { Provider } from 'ethers';
import { EvmAddress, EvmZeroAddress } from './address';
import { EvmPlatform } from './platform';
import { AnyEvmAddress } from './types';

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmUtils {
  export function nativeTokenId(chain: Chain): TokenId {
    if (!isSupportedChain(chain))
      throw new Error(`invalid chain for EVM: ${chain}`);
    return nativeChainAddress([chain, EvmZeroAddress]);
  }

  export function isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === EvmPlatform.platform;
  }

  export function isNativeTokenId(chain: Chain, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === EvmZeroAddress;
  }

  export async function getDecimals(
    chain: Chain,
    rpc: Provider,
    token: AnyEvmAddress | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(EvmPlatform.platform);

    const tokenContract = getTokenImplementation(
      rpc,
      new EvmAddress(token).toString(),
    );
    return tokenContract.decimals();
  }

  export async function getBalance(
    chain: Chain,
    rpc: Provider,
    walletAddr: string,
    token: AnyEvmAddress | 'native',
  ): Promise<bigint | null> {
    if (token === 'native') return rpc.getBalance(walletAddr);

    const tokenImpl = getTokenImplementation(
      rpc,
      new EvmAddress(token).toString(),
    );
    return tokenImpl.balanceOf(walletAddr);
  }

  export async function getBalances(
    chain: Chain,
    rpc: Provider,
    walletAddr: string,
    tokens: (AnyEvmAddress | 'native')[],
  ): Promise<Balances> {
    const balancesArr = await Promise.all(
      tokens.map(async (token) => {
        const balance = await getBalance(chain, rpc, walletAddr, token);
        const address =
          token === 'native' ? 'native' : new EvmAddress(token).toString();
        return { [address]: balance };
      }),
    );
    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  export async function sendWait(
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

  export async function getCurrentBlock(rpc: Provider): Promise<number> {
    return await rpc.getBlockNumber();
  }

  // Look up the Wormhole Canonical Network and Chain from the EVM chainId
  export function chainFromChainId(
    eip155ChainId: string,
  ): [Network, PlatformToChains<EvmPlatform.Type>] {
    const networkChainPair = chainIds.getNetworkAndChain(
      EvmPlatform.platform,
      eip155ChainId,
    );

    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${eip155ChainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  export async function chainFromRpc(
    rpc: Provider,
  ): Promise<[Network, PlatformToChains<EvmPlatform.Type>]> {
    const { chainId } = await rpc.getNetwork();
    return chainFromChainId(encoding.bignum.encode(chainId, true));
  }

  export function getTokenImplementation(
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
