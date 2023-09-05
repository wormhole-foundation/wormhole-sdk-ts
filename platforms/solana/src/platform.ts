import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { ChainName } from '@wormhole-foundation/sdk-base';
import {
  Platform,
  TokenId,
  TokenBridge,
  AutomaticTokenBridge,
  CircleBridge,
  AutomaticCircleBridge,
  SignedTxn,
  TxHash,
  WormholeMessageId,
  ChainsConfig,
  ChainContext,
  toNative,
} from '@wormhole-foundation/sdk-definitions';

import { SolanaContracts } from './contracts';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { SolanaChain } from './chain';
import { SolanaTokenBridge } from './protocols/tokenBridge';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

/**
 * @category Solana
 */
export class SolanaPlatform implements Platform<'Solana'> {
  static readonly _platform: 'Solana' = 'Solana';
  readonly platform = SolanaPlatform._platform;

  readonly conf: ChainsConfig;
  readonly contracts: SolanaContracts;

  constructor(conf: ChainsConfig) {
    this.conf = conf;
    this.contracts = new SolanaContracts(conf);
  }

  getRpc(chain: ChainName, commitment: Commitment = 'confirmed'): Connection {
    const rpcAddress = this.conf[chain]!.rpc;
    return new Connection(rpcAddress, commitment);
  }

  getChain(chain: ChainName): ChainContext<'Solana'> {
    return new SolanaChain(this, chain);
  }

  async getWrappedAsset(
    chain: ChainName,
    rpc: Connection,
    token: TokenId,
  ): Promise<TokenId | null> {
    if (token.chain === chain) return token;

    try {
      const tb = await this.getTokenBridge(rpc);
      const asset = await tb.getWrappedAsset(token);
      return { chain, address: asset.toUniversalAddress() };
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  async getTokenDecimals(rpc: Connection, token: TokenId): Promise<bigint> {
    let mint = await rpc.getParsedAccountInfo(
      new PublicKey(token.address.unwrap()),
    );
    if (!mint) throw new Error('could not fetch token details');
    const { decimals } = (mint as any).value.data.parsed.info;
    return decimals;
  }

  async getNativeBalance(rpc: Connection, walletAddr: string): Promise<bigint> {
    return BigInt(await rpc.getBalance(new PublicKey(walletAddr)));
  }

  async getTokenBalance(
    chain: ChainName,
    rpc: Connection,
    walletAddress: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    const address = await this.getWrappedAsset(chain, rpc, tokenId);
    if (!address) return null;

    const splToken = await rpc.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(address) },
    );
    if (!splToken.value[0]) return null;
    const balance = await rpc.getTokenAccountBalance(splToken.value[0].pubkey);

    return BigInt(balance.value.amount);
  }

  async sendWait(rpc: Connection, stxns: SignedTxn[]): Promise<TxHash[]> {
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
  async getTokenBridge(rpc: Connection): Promise<TokenBridge<'Solana'>> {
    return SolanaTokenBridge.fromProvider(rpc, this.contracts);
  }

  async getAutomaticTokenBridge(
    rpc: Connection,
  ): Promise<AutomaticTokenBridge<'Solana'>> {
    throw new Error('Not Supported');
  }

  async getCircleBridge(rpc: Connection): Promise<CircleBridge<'Solana'>> {
    throw new Error('Not Supported');
  }

  async getAutomaticCircleBridge(
    rpc: Connection,
  ): Promise<AutomaticCircleBridge<'Solana'>> {
    throw new Error('Not Supported');
  }

  parseAddress(chain: ChainName, address: string): UniversalAddress {
    return toNative(chain, address).toUniversalAddress();
  }

  async parseTransaction(
    chain: ChainName,
    rpc: Connection,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const contracts = this.contracts.mustGetContracts(chain);
    if (!contracts.coreBridge) throw new Error('contracts not found');

    const response = await rpc.getTransaction(tx);
    if (!response || !response.meta?.innerInstructions![0].instructions)
      throw new Error('transaction not found');

    const instructions = response.meta?.innerInstructions![0].instructions;
    const accounts = response.transaction.message.accountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeInstructions = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex].toString();
      const wormholeCore = contracts.coreBridge;
      return programId === wormholeCore;
    });

    if (bridgeInstructions.length === 0)
      throw new Error('no bridge messages found');

    // TODO: unsure about the single bridge instruction and the [2] index, will this always be the case?
    const [logmsg] = bridgeInstructions;
    const emitterAcct = accounts[logmsg.accounts[2]];
    const emitter = this.parseAddress(chain, emitterAcct.toString());

    const sequence = response.meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');

    if (!sequence) {
      throw new Error('sequence not found');
    }

    return [
      {
        chain,
        emitter: emitter.toUniversalAddress(),
        sequence: BigInt(sequence),
      },
    ];
  }
}
