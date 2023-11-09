import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  BlockheightBasedTransactionConfirmationStrategy,
  Connection,
  ParsedAccountData,
  PublicKey,
} from '@solana/web3.js';
import {
  Balances,
  ChainName,
  Network,
  PlatformToChains,
  RpcConnection,
  SignedTx,
  TokenId,
  TxHash,
  canonicalChainIds,
  chainToPlatform,
  nativeChainAddress,
  nativeDecimals,
} from '@wormhole-foundation/connect-sdk';
import { SolanaAddress, SolanaZeroAddress } from './address';
import { SolanaPlatform } from './platform';
import { AnySolanaAddress } from './types';

/**
 * @category Solana
 */
// Provides runtime concrete value
export module SolanaUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain)) throw new Error(`invalid chain: ${chain}`);
    return nativeChainAddress([chain, SolanaZeroAddress]);
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
    token: AnySolanaAddress | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(SolanaPlatform.platform);

    let mint = await rpc.getParsedAccountInfo(
      new SolanaAddress(token).unwrap(),
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
    const txhashes = await Promise.all(
      stxns.map((stxn) => rpc.sendRawTransaction(stxn)),
    );

    const { blockhash, lastValidBlockHeight } = await rpc.getLatestBlockhash(
      rpc.commitment,
    );

    await Promise.all(
      txhashes.map((txid) => {
        const bhs: BlockheightBasedTransactionConfirmationStrategy = {
          signature: txid,
          blockhash,
          lastValidBlockHeight,
        };
        return rpc.confirmTransaction(bhs, rpc.commitment);
      }),
    );

    return txhashes;
  }

  export async function getCurrentBlock(rpc: Connection): Promise<number> {
    return await rpc.getSlot(rpc.commitment);
  }

  export function chainFromChainId(
    genesisHash: string,
  ): [Network, PlatformToChains<SolanaPlatform.Type>] {
    const netChain = canonicalChainIds.getNetworkAndChainName(
      SolanaPlatform.platform,
      genesisHash,
    );

    if (!netChain) {
      // Note: this is required for tilt/ci since it gets a new genesis hash
      if (SolanaPlatform.network === 'Devnet') return ['Devnet', 'Solana'];

      throw new Error(
        `No matching genesis hash to determine network and chain: ${genesisHash}`,
      );
    }

    const [network, chain] = netChain;
    return [network, chain];
  }

  export async function chainFromRpc(
    rpc: RpcConnection<SolanaPlatform.Type>,
  ): Promise<[Network, PlatformToChains<SolanaPlatform.Type>]> {
    const conn = rpc as Connection;
    const gh = await conn.getGenesisHash();
    return chainFromChainId(gh);
  }
}
