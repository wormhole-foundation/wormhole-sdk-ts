import {
  ChainName,
  WormholeMessageId,
  ChainsConfig,
  toNative,
  networkPlatformConfigs,
  DEFAULT_NETWORK,
  Network,
  Platform,
  ProtocolName,
  loadProtocolModule,
  TokenBridge,
  WormholeCore,
} from '@wormhole-foundation/connect-sdk';
import { SolanaChain } from './chain';
import { SolanaUtils } from './platformUtils';

import { Commitment, Connection } from '@solana/web3.js';

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

  export const {
    nativeTokenId,
    isNativeTokenId,
    isSupportedChain,
    getDecimals,
    getBalance,
    getBalances,
    sendWait,
    getCurrentBlock,
    chainFromChainId,
    chainFromRpc,
  } = SolanaUtils;

  export function setConfig(
    _network: Network,
    _conf?: ChainsConfig,
  ): typeof SolanaPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    network = _network;
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

  export async function getProtocol<P extends ProtocolName>(
    protocol: P,
  ): Promise<any> {
    try {
      switch (protocol) {
        case 'TokenBridge':
        case 'AutomaticTokenBridge':
          const tb = await loadProtocolModule(platform, 'tokenbridge');
          if (platform + protocol in tb) return tb[platform + protocol];
        case 'CircleBridge':
        case 'AutomaticCircleBridge':
          const cb = await loadProtocolModule(platform, 'cctp');
          if (platform + protocol in cb) return cb[platform + protocol];
        case 'WormholeCore':
          const core = await loadProtocolModule(platform, 'core');
          if (platform + protocol in core) return core[platform + protocol];
        default:
          throw new Error('Protocol not supported: ' + protocol);
      }
    } catch (e) {
      console.error('Error loading ' + protocol, e);
      throw e;
    }
  }

  export async function getWormholeCore(
    rpc: Connection,
  ): Promise<WormholeCore<'Solana'>> {
    return (await getProtocol('WormholeCore')).fromProvider(rpc, conf);
  }

  export async function getTokenBridge(
    rpc: Connection,
  ): Promise<TokenBridge<'Solana'>> {
    return (await getProtocol('TokenBridge')).fromProvider(rpc, conf);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: Connection,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const core = await getWormholeCore(rpc);
    return core.parseTransaction(tx);
  }
}
