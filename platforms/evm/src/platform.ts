import {
  AutomaticCircleBridge,
  AutomaticTokenBridge,
  Chain,
  ChainsConfig,
  CircleBridge,
  DEFAULT_NETWORK,
  Network,
  ProtocolInitializer,
  ProtocolName,
  TokenBridge,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  networkPlatformConfigs,
  getProtocolInitializer,
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmChain } from './chain';
import { EvmUtils } from './platformUtils';
import { EvmChains } from './types';

/**
 * @category EVM
 */
export module EvmPlatform {
  export const platform = 'Evm';
  export type Type = typeof platform;
  export let network: Network = DEFAULT_NETWORK;
  export let config: ChainsConfig<typeof network, Type> = networkPlatformConfigs(network, platform);

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
    getTokenImplementation,
  } = EvmUtils;

  export function setConfig<N extends Network>(
    _network: N,
    _config?: ChainsConfig<N, Type>,
  ): typeof EvmPlatform {
    config = _config ? _config : networkPlatformConfigs(network, platform);
    network = _network;
    return EvmPlatform;
  }

  export function getRpc<C extends EvmChains>(chain: C): ethers.Provider {
    if (chain in config) return ethers.getDefaultProvider(config[chain].rpc);
    throw new Error('No configuration available for chain: ' + chain);
  }

  export function getChain<C extends EvmChains>(chain: C): EvmChain<typeof network, C> {
    if (chain in config) return new EvmChain(config[chain]);
    throw new Error('No configuration available for chain: ' + chain);
  }

  export function getProtocol<PN extends ProtocolName>(
    protocol: PN,
  ): ProtocolInitializer<Type> {
    return getProtocolInitializer(platform, protocol);
  }

  export async function getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<WormholeCore<Type>> {
    return getProtocol('WormholeCore').fromRpc(rpc, config);
  }
  export async function getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<TokenBridge<Type>> {
    return getProtocol('TokenBridge').fromRpc(rpc, config);
  }
  export async function getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<Type>> {
    return getProtocol('TokenBridge').fromRpc(rpc, config);
  }
  export async function getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<CircleBridge<Type>> {
    return getProtocol('CircleBridge').fromRpc(rpc, config);
  }
  export async function getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<Type>> {
    return getProtocol('AutomaticCircleBridge').fromRpc(rpc, config);
  }

  export async function parseTransaction(
    chain: Chain,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const wc = await getWormholeCore(rpc);
    return wc.parseTransaction(txid);
  }
}
