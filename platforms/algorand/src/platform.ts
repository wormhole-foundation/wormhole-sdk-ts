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
import { AlgorandChain } from './chain';
import { Algodv2 } from 'algosdk';
import { AlgorandUtils } from './platformUtils';

/**
 * @category Algorand
 */
export module AlgorandPlatform {
  export const platform = 'Algorand';
  export let network: Network = DEFAULT_NETWORK;
  export let config: ChainsConfig = networkPlatformConfigs(network, platform);
  export type Type = typeof platform;

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
  } = AlgorandUtils;

  export function setConfig(
    _network: Network,
    _config?: ChainsConfig,
  ): typeof AlgorandPlatform {
    config = _config ? _config : networkPlatformConfigs(network, platform);
    network = _network;
    return AlgorandPlatform;
  }

  export function getRpc(chain: ChainName): Algodv2 {
    const rpcAddress = config[chain]!.rpc;
    return new Algodv2('', rpcAddress, '');
  }

  export function getChain(chain: ChainName): AlgorandChain {
    if (chain in config) return new AlgorandChain(config[chain]!);
    throw new Error('No configuration available for chain: ' + chain);
  }

  export function getProtocol<P extends ProtocolName>(
    protocol: P,
  ): ProtocolInitializer<Type> {
    return getProtocolInitializer(platform, protocol);
  }

  export async function getWormholeCore(
    rpc: Algodv2,
  ): Promise<WormholeCore<'Algorand'>> {
    return getProtocol('WormholeCore').fromRpc(rpc, config);
  }

  export async function getTokenBridge(
    rpc: Algodv2,
  ): Promise<TokenBridge<'Algorand'>> {
    return getProtocol('TokenBridge').fromRpc(rpc, config);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: Algodv2,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const core = await getWormholeCore(rpc);
    return core.parseTransaction(tx);
  }
}
