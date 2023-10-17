import { Commitment, Connection } from '@solana/web3.js';
import {
  ChainName,
  WormholeMessageId,
  ChainsConfig,
  toNative,
  networkPlatformConfigs,
  DEFAULT_NETWORK,
  Network,
  Platform,
} from '@wormhole-foundation/connect-sdk';

import { SolanaContracts } from './contracts';
import { SolanaChain } from './chain';
import { SolanaTokenBridge } from './protocols/tokenBridge';
import { SolanaUtils } from './platformUtils';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

// forces SolanaPlatform to implement Platform
var _: Platform<'Solana'> = SolanaPlatform;

/**
 * @category Solana
 */
export module SolanaPlatform {
  export const platform = 'Solana';
  export type Type = typeof platform;
  export let network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);

  let contracts: SolanaContracts = new SolanaContracts(conf);

  export const {
    nativeTokenId,
    isNativeTokenId,
    isSupportedChain,
    getDecimals,
    getBalance,
    getBalances,
    sendWait,
    getCurrentBlock,
    chainFromRpc,
  } = SolanaUtils;

  export function setConfig(
    network: Network,
    _conf?: ChainsConfig,
  ): typeof SolanaPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
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

  export function getChain(chain: ChainName): SolanaChain {
    if (chain in conf) return new SolanaChain(conf[chain]!);
    throw new Error('No configuration available for chain: ' + chain);
  }

  export async function getTokenBridge(
    rpc: Connection,
  ): Promise<SolanaTokenBridge> {
    return SolanaTokenBridge.fromProvider(rpc, contracts);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: Connection,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const _contracts = contracts.getContracts(chain);
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
    const emitter = toNative(chain, emitterAcct.toString());

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
