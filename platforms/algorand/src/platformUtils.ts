import {
  AnyAddress,
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  Network,
  PlatformToChains,
  nativeDecimals,
  chainToPlatform,
  Balances,
  nativeChainAddress,
  chainIds,
} from '@wormhole-foundation/connect-sdk';
import algosdk, { Algodv2 } from 'algosdk';

import { AlgorandZeroAddress } from './address';
import { AlgorandPlatform } from './platform';
import { AnyAlgorandAddress } from './types';

/**
 * @category Algorand
 */
// Provides runtime concrete value
export module AlgorandUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain))
      throw new Error(`invalid chain for Algorand: ${chain}`);
    return nativeChainAddress([chain, AlgorandZeroAddress]);
  }

  export function isSupportedChain(chain: ChainName): boolean {
    const platform = chainToPlatform(chain);
    return platform === AlgorandPlatform.platform;
  }

  export function isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === AlgorandZeroAddress;
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: Algodv2,
    token: AnyAlgorandAddress | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(AlgorandPlatform.platform);
    else if (typeof token === 'number') {
      const assetInfo = await rpc.getAssetByID(token).do();
      return BigInt(assetInfo['params'].decimals);
    } else {
      throw new Error('Need a "number" or "native" for Algorand ASA balance');
    }
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Algodv2,
    walletAddr: string,
    token: AnyAddress | 'native',
  ): Promise<bigint | null> {
    // Algorand uses IDs for the ASAs

    if (typeof token === 'string' && token === 'native') {
      const accountInfo = await rpc.accountInformation(walletAddr).do();
      return BigInt(accountInfo['amount']);
    } else if (typeof token === 'number') {
      try {
        const accountASAInfo = await rpc
          .accountAssetInformation(walletAddr, token)
          .do();
        return BigInt(accountASAInfo['asset-holding'].amount);
      } catch (e) {
        throw new Error(
          `Failed to get ASA (id: ${token}) balance for ${walletAddr}`,
          e,
        );
      }
    } else {
      throw new Error('Need a "number" or "native" for Algorand ASA balance');
    }
  }

  export async function getBalances(
    chain: ChainName,
    rpc: Algodv2,
    walletAddr: string,
    tokens: (AnyAddress | 'native')[],
  ): Promise<Balances> {
    const balancesArr = await Promise.all(
      tokens.map(async (token) => {
        const balance = await getBalance(chain, rpc, walletAddr, token);
        const assetId = token === 'native' ? 'native' : token.toString();
        return { [assetId]: balance };
      }),
    );
    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  export async function sendWait(
    chain: ChainName,
    rpc: Algodv2,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    const txhashes = await Promise.all(
      stxns.map(async (stxn) => {
        const response = await rpc.sendRawTransaction(stxn).do();
        return response.txId;
      }),
    );

    await Promise.all(
      txhashes.map((txid) => algosdk.waitForConfirmation(rpc, txid, 4)),
    );

    return txhashes;
  }

  export async function getCurrentBlock(rpc: Algodv2): Promise<number> {
    const clientStatus = await rpc.status().do();
    return clientStatus['last-round'];
  }

  // Look up the Wormhole Canonical Network and Chain from the EVM chainId
  export function chainFromChainId(
    genesisId: string,
  ): [Network, PlatformToChains<AlgorandPlatform.Type>] {
    const netChain = chainIds.getNetworkAndChainName(
      AlgorandPlatform.platform,
      genesisId,
    );

    const [network, chain] = netChain;
    return [network, chain];
  }

  export async function chainFromRpc(
    rpc: Algodv2,
  ): Promise<[Network, PlatformToChains<AlgorandPlatform.Type>]> {
    const versionsDetails = await rpc.versionsCheck().do();
    return chainFromChainId(versionsDetails['genesis_id']);
  }
}
