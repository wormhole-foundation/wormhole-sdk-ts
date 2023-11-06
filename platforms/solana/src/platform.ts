import {
  ChainName,
  ChainsConfig,
  DEFAULT_NETWORK,
  Network,
  ProtocolInitializer,
  ProtocolName,
  TokenBridge,
  WormholeCore,
  WormholeMessageId,
  getProtocolInitializer,
  networkPlatformConfigs,
} from '@wormhole-foundation/connect-sdk';
import { SolanaChain } from './chain';
import { SolanaUtils } from './platformUtils';

import { Commitment, Connection } from '@solana/web3.js';

/**
 * @category Solana
 */
export module SolanaPlatform {
  export const platform = 'Solana';
  export type Type = typeof platform;
  export let network: Network = DEFAULT_NETWORK;
  export let config: ChainsConfig = networkPlatformConfigs(network, platform);

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
    _config?: ChainsConfig,
  ): typeof SolanaPlatform {
    config = _config ? _config : networkPlatformConfigs(network, platform);
    network = _network;
    return SolanaPlatform;
  }

  export function getRpc(
    chain: ChainName,
    commitment: Commitment = 'confirmed',
  ): Connection {
    const rpcAddress = config[chain]!.rpc;
    return new Connection(rpcAddress, commitment);
  }

  export function getChain(chain: ChainName): SolanaChain {
    if (chain in config) return new SolanaChain(config[chain]!);
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
    return getProtocol('WormholeCore').fromRpc(rpc, config);
  }

  export async function getTokenBridge(
    rpc: Connection,
  ): Promise<TokenBridge<'Solana'>> {
    return getProtocol('TokenBridge').fromRpc(rpc, config);
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
