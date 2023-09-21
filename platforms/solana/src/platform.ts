import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import {
  ChainName,
  Platform,
  TokenId,
  TokenBridge,
  SignedTx,
  TxHash,
  WormholeMessageId,
  ChainsConfig,
  ChainContext,
  toNative,
  NativeAddress,
  networkPlatformConfigs,
} from '@wormhole-foundation/connect-sdk';

import { SolanaContracts } from './contracts';
import { SolanaChain } from './chain';
import { SolanaTokenBridge } from './protocols/tokenBridge';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

const _: Platform<'Solana'> = SolanaPlatform;
/**
 * @category Solana
 */
export module SolanaPlatform {
  export const platform: 'Solana' = 'Solana';
  export let conf: ChainsConfig = networkPlatformConfigs('Testnet', platform);
  let contracts: SolanaContracts = new SolanaContracts(conf);

  export function setConfig(_conf: ChainsConfig): Platform<'Solana'> {
    conf = _conf;
    contracts = new SolanaContracts(conf);
    return SolanaPlatform;
  }

  export function getRpc(
    chain: ChainName,
    commitment: Commitment = 'confirmed',
  ): Connection {
    const rpcAddress = conf[chain]!.rpc;
    return new Connection(rpcAddress, commitment);
  }

  export function getChain(chain: ChainName): ChainContext<'Solana'> {
    return new SolanaChain(chain);
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: Connection,
    token: TokenId | 'native',
  ): Promise<bigint> {
    if (token === 'native') return BigInt(conf[chain]?.nativeTokenDecimals!);

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

    if (token.chain !== chain) {
      const tb = await getTokenBridge(rpc);
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

  export async function getTokenBridge(
    rpc: Connection,
  ): Promise<TokenBridge<'Solana'>> {
    return SolanaTokenBridge.fromProvider(rpc, contracts);
  }

  export function parseAddress(
    chain: ChainName,
    address: string,
  ): NativeAddress<'Solana'> {
    return toNative(chain, address) as NativeAddress<'Solana'>;
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: Connection,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const _contracts = contracts.mustGetContracts(chain);
    if (!_contracts.coreBridge) throw new Error('contracts not found');

    const response = await rpc.getTransaction(tx);
    if (!response || !response.meta?.innerInstructions![0].instructions)
      throw new Error('transaction not found');

    const instructions = response.meta?.innerInstructions![0].instructions;
    const accounts = response.transaction.message.accountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeInstructions = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex].toString();
      const wormholeCore = _contracts.coreBridge;
      return programId === wormholeCore;
    });

    if (bridgeInstructions.length === 0)
      throw new Error('no bridge messages found');

    // TODO: unsure about the single bridge instruction and the [2] index, will this always be the case?
    const [logmsg] = bridgeInstructions;
    const emitterAcct = accounts[logmsg.accounts[2]];
    const emitter = parseAddress(chain, emitterAcct.toString());

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
