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
  UniversalOrNative,
  Balances,
} from '@wormhole-foundation/connect-sdk';
import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js';
import { solGenesisHashToNetworkChainPair } from './constants';
import { SolanaPlatform } from './platform';
import { SolanaAddress, SolanaZeroAddress } from './address';
import { AnySolanaAddress } from './types';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// forces SolanaUtils to implement PlatformUtils
var _: PlatformUtils<'Solana'> = SolanaUtils;

/**
 * @category Solana
 */
// Provides runtime concrete value
export module SolanaUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain)) throw new Error(`invalid chain: ${chain}`);
    return {
      chain: chain,
      address: new SolanaAddress(SolanaZeroAddress) as any, // TODO: fix weird type error
    };
  }

  export function isSupportedChain(chain: ChainName): boolean {
    const platform = chainToPlatform(chain);
    return platform === SolanaPlatform.platform;
  }

  export function isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = nativeTokenId(chain);
    return native == tokenId;
  }
  export async function getDecimals(
    chain: ChainName,
    rpc: Connection,
    token: UniversalOrNative<'Solana'> | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(SolanaPlatform.platform);

    let mint = await rpc.getParsedAccountInfo(
      new PublicKey(token.toUint8Array()),
    );

    if (!mint || !mint.value) throw new Error('could not fetch token details');

    const { decimals } = (mint.value.data as ParsedAccountData).parsed.info;
    return BigInt(decimals);
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Connection,
    walletAddress: string,
    token: AnySolanaAddress | 'native',
  ): Promise<bigint | null> {
    if (token === 'native')
      return BigInt(await rpc.getBalance(new PublicKey(walletAddress)));

    // if (token.chain !== chain) {
    //   const tb = await getTokenBridge(rpc);
    //   token = { chain: chain, address: await tb.getWrappedAsset(token) };
    // }

    const splToken = await rpc.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new SolanaAddress(token).unwrap() },
    );
    if (!splToken.value[0]) return null;

    const balance = await rpc.getTokenAccountBalance(splToken.value[0].pubkey);
    return BigInt(balance.value.amount);
  }

  export async function getBalances(
    chain: ChainName,
    rpc: Connection,
    walletAddress: string,
    tokens: (AnySolanaAddress | 'native')[],
  ): Promise<Balances> {
    let native: bigint;
    if (tokens.includes('native')) {
      native = BigInt(await rpc.getBalance(new PublicKey(walletAddress)));
    }

    const splParsedTokenAccounts = await rpc.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      {
        programId: new PublicKey(TOKEN_PROGRAM_ID),
      },
    );

    const balancesArr = tokens.map((token) => {
      if (token === 'native') {
        return { ['native']: native };
      }
      const addrString = new SolanaAddress(token).toString();
      const amount = splParsedTokenAccounts.value.find(
        (v) => v?.account.data.parsed?.info?.mint === token,
      )?.account.data.parsed?.info?.tokenAmount?.amount;
      if (!amount) return { [addrString]: null };
      return { [addrString]: BigInt(amount) };
    });

    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  export async function sendWait(
    chain: ChainName,
    rpc: Connection,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];

    // TODO: concurrent?
    let lastTxHash: TxHash;
    for (const stxn of stxns) {
      const txHash = await rpc.sendRawTransaction(stxn);
      // TODO: throw error?
      if (!txHash) continue;
      lastTxHash = txHash;
      txhashes.push(txHash);
    }

    // TODO: allow passing commitment level in? this method is also deprecated...
    await rpc.confirmTransaction(lastTxHash!, 'finalized');

    return txhashes;
  }

  export async function getCurrentBlock(rpc: Connection): Promise<number> {
    return await rpc.getSlot();
  }

  export async function chainFromRpc(
    rpc: RpcConnection<SolanaPlatform.Type>,
  ): Promise<[Network, PlatformToChains<SolanaPlatform.Type>]> {
    const conn = rpc as Connection;
    const gh = await conn.getGenesisHash();
    const netChain = solGenesisHashToNetworkChainPair.get(gh);
    if (!netChain)
      throw new Error(
        `No matching genesis hash to determine network and chain: ${gh}`,
      );

    const [network, chain] = netChain;
    return [network, chain];
  }
}
