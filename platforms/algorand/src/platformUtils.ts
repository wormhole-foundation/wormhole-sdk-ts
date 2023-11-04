import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  RpcConnection,
  Network,
  PlatformToChains,
  nativeDecimals,
  PlatformUtils,
  chainToPlatform,
  Balances,
} from '@wormhole-foundation/connect-sdk';
import { AlgorandAddress, AlgorandZeroAddress } from './address';
import { AlgorandPlatform } from './platform';
import { Algodv2, bytesToBigInt, waitForConfirmation } from 'algosdk';
import {
  Account,
  AssetHolding,
  Version,
} from 'algosdk/dist/types/client/v2/algod/models/types';
import { algorandGenesisHashToNetworkChainPair } from './constants';
import { AnyAlgorandAddress } from '../dist/cjs';

// forces AlgorandUtils to implement PlatformUtils
var _: PlatformUtils<'Algorand'> = AlgorandUtils;

/**
 * @category Algorand
 */
// Provides runtime concrete value
export module AlgorandUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain)) throw new Error(`invalid chain: ${chain}`);
    return {
      chain: chain,
      // @ts-ignore
      address: new AlgorandAddress(AlgorandZeroAddress),
    };
  }

  export function isSupportedChain(chain: ChainName): boolean {
    const platform = chainToPlatform(chain);
    return platform === AlgorandPlatform.platform;
  }

  export function isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = nativeTokenId(chain);
    return native == tokenId;
  }

  function anyAlgorandAddressToAsaId(address: AnyAlgorandAddress): number {
    const a = new AlgorandAddress(address);
    const lastEightBytes = a.toUint8Array().slice(-8);
    const asaId = Number(bytesToBigInt(lastEightBytes));
    return asaId;
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: Algodv2,
    token: AnyAlgorandAddress | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(AlgorandPlatform.platform);
    const asaId = anyAlgorandAddressToAsaId(token);
    const { params } = await rpc.getAssetByID(asaId).do();
    if (!params || !params.decimals)
      throw new Error('Could not fetch token details');
    return BigInt(params.decimals);
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Algodv2,
    walletAddress: string,
    token: AnyAlgorandAddress | 'native',
  ): Promise<bigint | null> {
    if (token === 'native') {
      const resp = await rpc.accountInformation(walletAddress).do();
      const accountInfo = Account.from_obj_for_encoding(resp);
      return BigInt(accountInfo.amount);
    }
    const asaId = anyAlgorandAddressToAsaId(token);
    const resp = await rpc.accountAssetInformation(walletAddress, asaId).do();
    const accountAssetInfo = AssetHolding.from_obj_for_encoding(resp);
    return BigInt(accountAssetInfo.amount);
  }

  export async function getBalances(
    chain: ChainName,
    rpc: Algodv2,
    walletAddress: string,
    tokens: (AnyAlgorandAddress | 'native')[],
  ): Promise<Balances> {
    let native: bigint;
    if (tokens.includes('native')) {
      const resp = await rpc.accountInformation(walletAddress).do();
      const accountInfo = Account.from_obj_for_encoding(resp);
      native = BigInt(accountInfo.amount);
    }
    const balancesArr = tokens.map(async (token) => {
      if (token === 'native') {
        return { ['native']: native };
      }
      const asaId = anyAlgorandAddressToAsaId(token);
      const resp = await rpc.accountAssetInformation(walletAddress, asaId).do();
      const accountAssetInfo = AssetHolding.from_obj_for_encoding(resp);
      return BigInt(accountAssetInfo.amount);
    });

    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  export async function sendWait(
    chain: ChainName,
    rpc: Algodv2,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    const rounds = 4;
    const sentTransaction = await rpc.sendRawTransaction(stxns).do();
    if (!sentTransaction) {
      throw new Error('Transaction(s) failed to send');
    }
    const confirmedTransaction = await waitForConfirmation(
      rpc,
      sentTransaction.txId,
      rounds,
    );
    if (!confirmedTransaction['round-number']) {
      throw new Error(
        `Transaction(s) could not be confirmed in ${rounds} rounds`,
      );
    }
    return sentTransaction.txId;
  }

  export async function getCurrentBlock(rpc: Algodv2): Promise<number> {
    const status = await rpc.status().do();
    if (!status['last-round']) {
      throw new Error('Error getting last round from node status');
    }
    return status['last-round'];
  }

  export function chainFromChainId(
    genesisHash: string,
  ): [Network, PlatformToChains<AlgorandPlatform.Type>] {
    const netChain = algorandGenesisHashToNetworkChainPair.get(genesisHash);

    if (!netChain) {
      // Note: this is required for tilt/ci since it gets a new genesis hash
      if (AlgorandPlatform.network === 'Devnet') return ['Devnet', 'Algorand'];

      throw new Error(
        `No matching genesis hash to determine network and chain: ${genesisHash}`,
      );
    }

    const [network, chain] = netChain;
    return [network, chain];
  }

  export async function chainFromRpc(
    rpc: RpcConnection<AlgorandPlatform.Type>,
  ): Promise<[Network, PlatformToChains<AlgorandPlatform.Type>]> {
    const conn = rpc as Algodv2;
    const resp = await conn.versionsCheck().do();
    const version = Version.from_obj_for_encoding(resp);
    const gHash = Buffer.from(version.genesisHashB64).toString('ascii');
    return chainFromChainId(gHash);
  }
}
