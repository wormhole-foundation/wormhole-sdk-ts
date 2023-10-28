import {
  ChainName,
  TxHash,
  WormholeMessageId,
  isWormholeMessageId,
  ChainsConfig,
  networkPlatformConfigs,
  DEFAULT_NETWORK,
  Network,
  toNative,
  Platform,
  TokenBridge,
  AutomaticTokenBridge,
  CircleBridge,
  AutomaticCircleBridge,
  WormholeCore,
  ProtocolName,
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

  async function loadModule(module: string): Promise<Record<string, any>> {
    try {
      // @ts-ignore -- complains about commonjs but compiles?
      return await import('@wormhole-foundation/connect-sdk-evm-' + module);
    } catch (e) {
      console.error('Error loading ' + module, e);
      throw e;
    }
  }

  export async function getProtocol<P extends ProtocolName>(protocol: P): Promise<any> {
    try {
      switch (protocol) {
        case 'TokenBridge':
        case 'AutomaticTokenBridge':
          const tb = await loadModule('tokenbridge');
          if (platform + protocol in tb)
            return tb[platform + protocol]
        case 'CircleBridge':
        case 'AutomaticCircleBridge':
          const cb = await loadModule('cctp');
          if (platform + protocol in cb)
            return cb[platform + protocol]
        default:
          throw new Error("Protocol not supported: " + protocol)
      }
    } catch (e) {
      console.error('Error loading ' + protocol, e);
      throw e;
    }
  }

  export async function getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<TokenBridge<'Evm'>> {
    return (await getProtocol('TokenBridge')).fromProvider(rpc, conf);
  }
  export async function getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<'Evm'>> {
    return (await getProtocol('TokenBridge')).fromProvider(rpc, conf);
  }


  export async function getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<WormholeCore<'Evm'>> {
    return (await getProtocol('CoreBridge')).fromProvider(rpc, conf);
  }

  export async function getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<CircleBridge<'Evm'>> {
    return (await getProtocol('CircleBridge')).fromProvider(rpc, conf);
  }

  export async function getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    return (await getProtocol('AutomaticCircleBridge')).fromProvider(rpc, conf);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const receipt = await rpc.getTransactionReceipt(txid);
    if (receipt === null) return [];

    const coreAddress = conf[chain]!.contracts.coreBridge;
    const coreImpl = EvmUtils.getCoreImplementationInterface();

    return receipt.logs
      .filter((l: any) => {
        return l.address === coreAddress;
      })
      .map((log) => {
        const { topics, data } = log;
        const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
        if (parsed === null) return undefined;

        const emitterAddress = toNative(chain, parsed.args.sender);
        return {
          chain: chain,
          emitter: emitterAddress.toUniversalAddress(),
          sequence: parsed.args.sequence,
        } as WormholeMessageId;
      })
      .filter(isWormholeMessageId);
  }
}
