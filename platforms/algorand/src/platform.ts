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
  networkPlatformConfigs,
} from '@wormhole-foundation/connect-sdk';
import { AlgorandChain } from './chain';
import { Algodv2 } from 'algosdk';
import { AlgorandUtils } from './platformUtils';

// forces AlgorandPlatform to implement Platform
var _: Platform<'Algorand'> = AlgorandPlatform;

/**
 * @category Algorand
 */
export module AlgorandPlatform {
  export const platform = 'Algorand';
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
  } = AlgorandUtils;

  export function setConfig(
    _network: Network,
    _conf?: ChainsConfig,
  ): typeof AlgorandPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    network = _network;
    return AlgorandPlatform;
  }

  export function getRpc(chain: ChainName): Algodv2 {
    const rpcAddress = conf[chain]!.rpc;
    return new Algodv2('', rpcAddress, '');
  }

  export function getChain(chain: ChainName): AlgorandChain {
    if (chain in conf) return new AlgorandChain(conf[chain]!);
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
    return getProtocol('WormholeCore').fromRpc(rpc, conf);
  }

  export async function getTokenBridge(
    rpc: Algodv2,
  ): Promise<TokenBridge<'Algorand'>> {
    return getProtocol('TokenBridge').fromRpc(rpc, conf);
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
