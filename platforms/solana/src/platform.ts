import {
  ChainName,
  ChainsConfig,
  DEFAULT_NETWORK,
  Network,
  Platform,
  ProtocolInitializer,
  ProtocolName,
  TokenBridge,
  WormholeCore,
  WormholeMessageId,
  getProtocolInitializer,
  networkPlatformConfigs
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

  const registeredProtocols = new Map<ProtocolName, any>();


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

  export function getProtocol<P extends ProtocolName>(
    protocol: P,
  ): ProtocolInitializer<Type> {
    return getProtocolInitializer(platform, protocol);
  }

  export async function getWormholeCore(
    rpc: Connection,
  ): Promise<WormholeCore<'Solana'>> {
    return getProtocol('WormholeCore').fromRpc(rpc, conf);
  }

  export async function getTokenBridge(
    rpc: Connection,
  ): Promise<TokenBridge<'Solana'>> {
    return getProtocol('TokenBridge').fromRpc(rpc, conf);
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
