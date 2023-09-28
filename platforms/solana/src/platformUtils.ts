import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  RpcConnection,
  Network,
  PlatformToChains,
  nativeDecimals,
} from '@wormhole-foundation/connect-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { solGenesisHashToNetworkChainPair } from './constants';
import { SolanaPlatform } from './platform';

/**
 * @category Solana
 */
// Provides runtime concrete value
export module SolanaUtils {
  export async function getDecimals(
    chain: ChainName,
    rpc: Connection,
    token: TokenId | 'native',
  ): Promise<bigint> {
    if (token === 'native') return nativeDecimals(SolanaPlatform.platform);

    let mint = await rpc.getParsedAccountInfo(
      new PublicKey(token.address.unwrap()),
    );
    if (!mint) throw new Error('could not fetch token details');
    const { decimals } = (mint as any).value.data.parsed.info;
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: Connection,
    walletAddress: string,
    token: TokenId | 'native',
  ): Promise<bigint | null> {
    if (token === 'native')
      return BigInt(await rpc.getBalance(new PublicKey(walletAddress)));

    // if (token.chain !== chain) {
    //   const tb = await getTokenBridge(rpc);
    //   token = { chain: chain, address: await tb.getWrappedAsset(token) };
    // }

    const splToken = await rpc.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(token.address.toUint8Array()) },
    );
    if (!splToken.value[0]) return null;

    const balance = await rpc.getTokenAccountBalance(splToken.value[0].pubkey);
    return BigInt(balance.value.amount);
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
