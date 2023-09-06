import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import {
  ChainName,
  Platform,
  TokenId,
  TokenBridge,
  AutomaticTokenBridge,
  CircleBridge,
  AutomaticCircleBridge,
  SignedTx,
  TxHash,
  WormholeMessageId,
  ChainsConfig,
  ChainContext,
  toNative,
  SolRpc,
  NativeAddress,
  WormholeCore,
} from '@wormhole-foundation/connect-sdk';

import { SolanaContracts } from './contracts';
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

  async getDecimals(
    chain: ChainName,
    rpc: Connection,
    token: TokenId | 'native',
  ): Promise<bigint> {
    if (token === 'native')
      return BigInt(this.conf[chain]?.nativeTokenDecimals!);

    let mint = await rpc.getParsedAccountInfo(
      new PublicKey(token.address.unwrap()),
    );
    if (!mint) throw new Error('could not fetch token details');
    const { decimals } = (mint as any).value.data.parsed.info;
    return decimals;
  }

  async getBalance(
    chain: ChainName,
    rpc: Connection,
    walletAddress: string,
    token: TokenId | 'native',
  ): Promise<bigint | null> {
    if (token === 'native')
      return BigInt(await rpc.getBalance(new PublicKey(walletAddress)));

    if (token.chain !== chain) {
      const tb = await this.getTokenBridge(rpc);
      token = { chain: chain, address: await tb.getWrappedAsset(token) };
    }

    const splToken = await rpc.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(token.address.toUint8Array()) },
    );
    if (!splToken.value[0]) return null;

    const balance = await rpc.getTokenAccountBalance(splToken.value[0].pubkey);
    return BigInt(balance.value.amount);
  }

  async sendWait(rpc: Connection, stxns: SignedTx[]): Promise<TxHash[]> {
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

  async getWormholeCore(rpc: SolRpc): Promise<WormholeCore<'Solana'>> {
    throw new Error('Not Supported');
    //return SolanaWormholeCore.fromProvider(rpc, this.contracts);
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

  parseAddress(chain: ChainName, address: string): NativeAddress<'Solana'> {
    return toNative(chain, address) as NativeAddress<'Solana'>;
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
