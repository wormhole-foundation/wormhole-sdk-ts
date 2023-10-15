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
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { EvmContracts } from './contracts';
import { EvmChain } from './chain';

import { EvmTokenBridge } from './protocols/tokenBridge';
import { EvmAutomaticTokenBridge } from './protocols/automaticTokenBridge';
import { EvmAutomaticCircleBridge } from './protocols/automaticCircleBridge';
import { EvmCircleBridge } from './protocols/circleBridge';
import { EvmWormholeCore } from './protocols/wormholeCore';
import { EvmUtils } from './platformUtils';

// forces EvmPlatform to implement Platform
var _: Platform<'Evm'> = EvmPlatform;

/**
 * @category EVM
 */
// Provides runtime concrete value
export module EvmPlatform {
  export const platform = 'Evm';
  export const network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);

  let contracts: EvmContracts = new EvmContracts(conf);

  export type Type = typeof platform;

  export const {
    nativeTokenId,
    isNativeTokenId,
    isSupportedChain,
    getDecimals,
    getBalance,
    sendWait,
    getCurrentBlock,
    chainFromRpc,
  } = EvmUtils;

  export function setConfig(
    network: Network,
    _conf?: ChainsConfig,
  ): typeof EvmPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    contracts = new EvmContracts(conf);
    return EvmPlatform;
  }

  export function getRpc(chain: ChainName): ethers.Provider {
    const rpcAddress = conf[chain]!.rpc;
    return ethers.getDefaultProvider(rpcAddress);
  }

  export function getChain(chain: ChainName): EvmChain {
    return new EvmChain(chain);
  }

  export function getWormholeCore(
    rpc: ethers.Provider,
  ): Promise<EvmWormholeCore> {
    return EvmWormholeCore.fromProvider(rpc, contracts);
  }

  export async function getTokenBridge(
    rpc: ethers.Provider,
  ): Promise<EvmTokenBridge> {
    return await EvmTokenBridge.fromProvider(rpc, contracts);
  }
  export async function getAutomaticTokenBridge(
    rpc: ethers.Provider,
  ): Promise<EvmAutomaticTokenBridge> {
    return await EvmAutomaticTokenBridge.fromProvider(rpc, contracts);
  }

  export async function getCircleBridge(
    rpc: ethers.Provider,
  ): Promise<EvmCircleBridge> {
    return await EvmCircleBridge.fromProvider(rpc, contracts);
  }

  export async function getAutomaticCircleBridge(
    rpc: ethers.Provider,
  ): Promise<EvmAutomaticCircleBridge> {
    return await EvmAutomaticCircleBridge.fromProvider(rpc, contracts);
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
