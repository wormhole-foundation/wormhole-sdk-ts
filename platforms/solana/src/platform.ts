import {
  ChainName,
  ChainsConfig,
  DEFAULT_NETWORK,
  Network,
  Platform,
  ProtocolName,
  TokenBridge,
  WormholeCore,
  WormholeMessageId,
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
    rpc: Connection,
  ): Promise<WormholeCore<'Solana'>> {
    return getProtocol('WormholeCore').fromProvider(rpc, conf);
  }

  export async function getTokenBridge(
    rpc: Connection,
  ): Promise<TokenBridge<'Solana'>> {
    return getProtocol('TokenBridge').fromProvider(rpc, conf);
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
