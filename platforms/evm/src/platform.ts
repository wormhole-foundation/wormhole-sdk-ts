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
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmContracts } from './contracts';
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

  let contracts: EvmContracts = new EvmContracts(conf);

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
  } = EvmUtils;

  export function setConfig(
    _network: Network,
    _conf?: ChainsConfig,
  ): typeof EvmPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    contracts = new EvmContracts(conf);
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

  export async function getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<WormholeCore<'Evm'>> {
    try {
      const {
        EvmWormholeCore,
      } = require('@wormhole-foundation/connect-sdk-evm-core');
      return await EvmWormholeCore.fromProvider(rpc, contracts);
    } catch (e) {
      console.error('Error loading EvmTokenBridge', e);
      throw e;
    }
  }

  export async function getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<TokenBridge<'Evm'>> {
    try {
      const {
        EvmTokenBridge,
      } = require('@wormhole-foundation/connect-sdk-evm-tokenbridge');
      return await EvmTokenBridge.fromProvider(rpc, contracts);
    } catch (e) {
      console.error('Error loading EvmTokenBridge', e);
      throw e;
    }
  }
  export async function getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticTokenBridge<'Evm'>> {
    try {
      const {
        EvmAutomaticTokenBridge,
      } = require('@wormhole-foundation/connect-sdk-evm-tokenbridge');
      return await EvmAutomaticTokenBridge.fromProvider(rpc, contracts);
    } catch (e) {
      console.error('Error loading EvmAutomaticTokenBridge', e);
      throw e;
    }
  }

  export async function getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<CircleBridge<'Evm'>> {
    try {
      const {
        EvmCircleBridge,
      } = require('@wormhole-foundation/connect-sdk-evm-cctp');
      return await EvmCircleBridge.fromProvider(rpc, contracts);
    } catch (e) {
      console.error('Error loading EvmAutomaticCircleBridge', e);
      throw e;
    }
  }

  export async function getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    try {
      const {
        EvmAutomaticCircleBridge,
      } = require('@wormhole-foundation/connect-sdk-evm-cctp');
      return await EvmAutomaticCircleBridge.fromProvider(rpc, contracts);
    } catch (e) {
      console.error('Error loading EvmAutomaticCircleBridge', e);
      throw e;
    }
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: ethers.Provider,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const receipt = await rpc.getTransactionReceipt(txid);
    if (receipt === null) return [];

    const coreAddress = conf[chain]!.contracts.coreBridge;
    const coreImpl = contracts.getCoreImplementationInterface();

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
