import {
  AutomaticCircleBridge,
  AutomaticTokenBridge,
  ChainName,
  ChainsConfig,
  CircleBridge,
  DEFAULT_NETWORK,
  Network,
  Platform,
  ProtocolName,
  TokenBridge,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  networkPlatformConfigs
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmChain } from './chain';
import { EvmUtils } from './platformUtils';

// forces EvmPlatform to implement Platform
var _: Platform<'Evm'> = EvmPlatform;

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmPlatform {
  export const platform = 'Evm';
  export let network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);
  export type Type = typeof platform;

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
    getTokenImplementation,
  } = EvmUtils;

  export function setConfig(
    _network: Network,
    _conf?: ChainsConfig,
  ): typeof EvmPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    network = _network;
    return EvmPlatform;
  }


  export function getRpc(chain: ChainName): ethers.Provider {
    if (chain in conf) return ethers.getDefaultProvider(conf[chain]!.rpc);
    throw new Error('No configuration available for chain: ' + chain);
  }

  export function getChain(chain: ChainName): EvmChain {
    if (chain in conf) return new EvmChain(conf[chain]!);
    throw new Error('No configuration available for chain: ' + chain);
  }

  export function registerProtocol<PN extends ProtocolName>(name: PN, module: any): void {
    if (registeredProtocols.has(name)) throw new Error('Protocol already registered: ' + name);
    registeredProtocols.set(name, module);
  }

  export function getProtocol<P extends ProtocolName>(
    protocol: P,
  ): any {
    if (!registeredProtocols.has(protocol))
      throw new Error('Protocol not registered: ' + protocol);
    return registeredProtocols.get(protocol);
  }

  export async function getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<WormholeCore<'Evm'>> {
    return getProtocol('WormholeCore').fromProvider(rpc, conf);
  }
  export async function getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<TokenBridge<'Evm'>> {
    return getProtocol('TokenBridge').fromProvider(rpc, conf);
  }
  export async function getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<'Evm'>> {
    return getProtocol('TokenBridge').fromProvider(rpc, conf);
  }
  export async function getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<CircleBridge<'Evm'>> {
    return getProtocol('CircleBridge').fromProvider(rpc, conf);
  }
  export async function getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    return getProtocol('AutomaticCircleBridge').fromProvider(rpc, conf);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const wc = await getWormholeCore(rpc);
    return wc.parseTransaction(txid);
  }
}
