import {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  PlatformContext,
  ProtocolImplementation,
  ProtocolInitializer,
  ProtocolName,
  SignedTx,
  TokenId,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  chainToPlatform,
  decimals,
  getProtocolInitializer,
  nativeChainAddress,
  nativeChainIds,
  networkPlatformConfigs,
} from '@wormhole-foundation/connect-sdk';
import { SolanaChain } from './chain';

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  BlockheightBasedTransactionConfirmationStrategy,
  Commitment,
  Connection,
  ParsedAccountData,
  PublicKey,
} from '@solana/web3.js';
import { SolanaAddress, SolanaZeroAddress } from './address';
import {
  AnySolanaAddress,
  SolanaChains,
  SolanaPlatformType,
  _platform,
} from './types';

/**
 * @category Solana
 */
export class SolanaPlatform<N extends Network>
  implements PlatformContext<N, SolanaPlatformType>
{
  static _platform = _platform;
  config: ChainsConfig<N, SolanaPlatformType>;

  constructor(
    readonly network: N,
    config?: ChainsConfig<N, SolanaPlatformType>,
  ) {
    this.config =
      config ?? networkPlatformConfigs(network, SolanaPlatform._platform);
  }

  static fromNetworkConfig<N extends Network>(
    network: N,
    config?: ChainsConfig<N, SolanaPlatformType>,
  ): SolanaPlatform<N> {
    return new SolanaPlatform(network, config);
  }

  getRpc<C extends SolanaChains>(
    chain: C,
    commitment: Commitment = 'confirmed',
  ): Connection {
    if (chain in this.config)
      return new Connection(this.config[chain].rpc, commitment);
    throw new Error('No configuration available for chain: ' + chain);
  }

  getChain<C extends SolanaChains>(chain: C): SolanaChain<N, C> {
    if (chain in this.config) return new SolanaChain<N, C>(chain, this);
    throw new Error('No configuration available for chain: ' + chain);
  }

  async getProtocol<PN extends ProtocolName>(
    protocol: PN,
    rpc: Connection,
  ): Promise<ProtocolImplementation<SolanaPlatformType, PN>> {
    return SolanaPlatform.getProtocolInitializer(protocol).fromRpc(
      rpc,
      this.config,
    );
  }
  async parseTransaction<C extends SolanaChains>(
    chain: C,
    rpc: Connection,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const wc: WormholeCore<N, SolanaPlatformType, C> = await this.getProtocol(
      'WormholeCore',
      rpc,
    );
    return wc.parseTransaction(tx);
  }

  static nativeTokenId<C extends Chain>(chain: C): TokenId<C> {
    if (!SolanaPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain: ${chain}`);
    return nativeChainAddress(chain, SolanaZeroAddress);
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === SolanaPlatform._platform;
  }

  static isNativeTokenId(chain: Chain, tokenId: TokenId): boolean {
    if (!this.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = this.nativeTokenId(chain);
    return native == tokenId;
  }
  static async getDecimals(
    chain: Chain,
    rpc: Connection,
    token: AnySolanaAddress | 'native',
  ): Promise<bigint> {
    if (token === 'native')
      return BigInt(decimals.nativeDecimals(SolanaPlatform._platform));

    let mint = await rpc.getParsedAccountInfo(
      new SolanaAddress(token).unwrap(),
    );

    if (!mint || !mint.value) throw new Error('could not fetch token details');

    const { decimals: numDecimals } = (mint.value.data as ParsedAccountData)
      .parsed.info;
    return BigInt(numDecimals);
  }

  static async getBalance(
    chain: Chain,
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

  static async getBalances(
    chain: Chain,
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

  static async sendWait(
    chain: Chain,
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

  static async getCurrentBlock(rpc: Connection): Promise<number> {
    return await rpc.getSlot(rpc.commitment);
  }

  static chainFromChainId(genesisHash: string): [Network, SolanaChains] {
    const netChain = nativeChainIds.platformNativeChainIdToNetworkChain(
      SolanaPlatform._platform,
      // @ts-ignore
      genesisHash,
    );

    if (!netChain)
      throw new Error(
        `No matching genesis hash to determine network and chain: ${genesisHash}`,
      );

    const [network, chain] = netChain;
    return [network, chain];
  }

  static async chainFromRpc(rpc: Connection): Promise<[Network, SolanaChains]> {
    const conn = rpc as Connection;
    const gh = await conn.getGenesisHash();
    return SolanaPlatform.chainFromChainId(gh);
  }

  static getProtocolInitializer<PN extends ProtocolName>(
    protocol: PN,
  ): ProtocolInitializer<typeof SolanaPlatform._platform, PN> {
    return getProtocolInitializer(this._platform, protocol);
  }
}
