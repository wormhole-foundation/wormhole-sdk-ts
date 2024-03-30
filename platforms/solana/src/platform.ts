import type {
  Balances,
  Chain,
  ChainsConfig,
  Network,
  SignedTx,
  StaticPlatformMethods,
  TokenId,
  TxHash,
} from '@wormhole-foundation/sdk-connect';
import {
  PlatformContext,
  Wormhole,
  chainToPlatform,
  decimals,
  nativeChainIds,
  networkPlatformConfigs,
  isNative,
} from '@wormhole-foundation/sdk-connect';
import { SolanaChain } from './chain.js';

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type {
  Commitment,
  ConnectionConfig,
  ParsedAccountData,
  SendOptions,
} from '@solana/web3.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { SolanaAddress, SolanaZeroAddress } from './address.js';
import type {
  AnySolanaAddress,
  SolanaChains,
  SolanaPlatformType,
} from './types.js';
import { _platform } from './types.js';

/**
 * @category Solana
 */
export class SolanaPlatform<N extends Network>
  extends PlatformContext<N, SolanaPlatformType>
  implements StaticPlatformMethods<SolanaPlatformType, typeof SolanaPlatform>
{
  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, SolanaPlatformType>) {
    super(
      network,
      config ?? networkPlatformConfigs(network, SolanaPlatform._platform),
    );
  }

  getRpc<C extends SolanaChains>(
    chain: C,
    config: ConnectionConfig = {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
    },
  ): Connection {
    if (chain in this.config)
      return new Connection(this.config[chain]!.rpc, config);
    throw new Error('No configuration available for chain: ' + chain);
  }

  getChain<C extends SolanaChains>(
    chain: C,
    rpc?: Connection,
  ): SolanaChain<N, C> {
    if (chain in this.config) return new SolanaChain<N, C>(chain, this, rpc);
    throw new Error('No configuration available for chain: ' + chain);
  }

  static nativeTokenId<N extends Network, C extends SolanaChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    if (!SolanaPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain: ${chain}`);
    return Wormhole.chainAddress(chain, SolanaZeroAddress);
  }

  static isNativeTokenId<N extends Network, C extends SolanaChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!this.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = this.nativeTokenId(network, chain);
    return native == tokenId;
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === SolanaPlatform._platform;
  }

  static async getDecimals(
    chain: Chain,
    rpc: Connection,
    token: AnySolanaAddress,
  ): Promise<number> {
    if (isNative(token))
      return decimals.nativeDecimals(SolanaPlatform._platform);

    let mint = await rpc.getParsedAccountInfo(
      new SolanaAddress(token).unwrap(),
    );

    if (!mint || !mint.value) throw new Error('could not fetch token details');

    const { decimals: numDecimals } = (mint.value.data as ParsedAccountData)
      .parsed.info;
    return numDecimals;
  }

  static async getBalance(
    chain: Chain,
    rpc: Connection,
    walletAddress: string,
    token: AnySolanaAddress,
  ): Promise<bigint | null> {
    const address = new PublicKey(walletAddress);
    if (isNative(token)) return BigInt(await rpc.getBalance(address));

    // Check to see if we were passed wallet address or token account
    const splToken = await rpc.getTokenAccountsByOwner(address, {
      mint: new SolanaAddress(token).unwrap(),
    });

    // Use the first token account if it exists, otherwise fall back to wallet address
    const checkAddress =
      splToken.value.length > 0 ? splToken.value[0]!.pubkey : address;

    const balance = await rpc.getTokenAccountBalance(checkAddress);
    return BigInt(balance.value.amount);
  }

  static async getBalances(
    chain: Chain,
    rpc: Connection,
    walletAddress: string,
    tokens: AnySolanaAddress[],
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
      if (isNative(token)) {
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
    opts?: SendOptions,
  ): Promise<TxHash[]> {
    const { blockhash, lastValidBlockHeight } = await this.latestBlock(rpc);
    const txhashes = await Promise.all(
      stxns.map((stxn) =>
        rpc.sendRawTransaction(
          stxn,
          // Set the commitment level to match the rpc commitment level
          // otherwise, it defaults to finalized
          opts ?? { preflightCommitment: rpc.commitment },
        ),
      ),
    );

    const results = await Promise.all(
      txhashes.map((signature) => {
        return rpc.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          rpc.commitment,
        );
      }),
    );

    const erroredTxs = results
      .filter((result) => result.value.err)
      .map((result) => result.value.err);

    if (erroredTxs.length > 0)
      throw new Error(`Failed to confirm transaction: ${erroredTxs}`);

    return txhashes;
  }

  static async latestBlock(
    rpc: Connection,
    commitment?: Commitment,
  ): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return rpc.getLatestBlockhash(commitment ?? rpc.commitment);
  }

  static async getLatestBlock(rpc: Connection): Promise<number> {
    return await rpc.getSlot();
  }

  static async getLatestFinalizedBlock(rpc: Connection): Promise<number> {
    const { lastValidBlockHeight } = await this.latestBlock(rpc, 'finalized');
    return lastValidBlockHeight;
  }

  static chainFromChainId(genesisHash: string): [Network, SolanaChains] {
    const netChain = nativeChainIds.platformNativeChainIdToNetworkChain(
      SolanaPlatform._platform,
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
    try {
      const gh = await rpc.getGenesisHash();
      return SolanaPlatform.chainFromChainId(gh);
    } catch (e) {
      // Override for devnet which will often have a new Genesis hash
      if (
        rpc.rpcEndpoint.includes('http://127') ||
        rpc.rpcEndpoint.includes('http://localhost') ||
        rpc.rpcEndpoint === 'http://solana-devnet:8899'
      ) {
        return ['Devnet', 'Solana'];
      }
      throw e;
    }
  }
}
