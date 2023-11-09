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
} from "@wormhole-foundation/connect-sdk";
import { AptosChain } from "./chain";
import { AptosUtils } from "./platformUtils";
import { AptosClient } from "aptos";

/**
 * @category Aptos
 */
export module AptosPlatform {
  export const platform = "Aptos";
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
  } = AptosUtils;

  export function setConfig(_network: Network, _config?: ChainsConfig): typeof AptosPlatform {
    config = _config ? _config : networkPlatformConfigs(network, platform);
    network = _network;
    return AptosPlatform;
  }

  export function getRpc(chain: ChainName): AptosClient {
    const rpcAddress = config[chain]!.rpc;
    return new AptosClient(rpcAddress);
  }

  export function getChain(chain: ChainName): AptosChain {
    if (chain in config) return new AptosChain(config[chain]!);
    throw new Error("No configuration available for chain: " + chain);
  }

  export function getProtocol<P extends ProtocolName>(protocol: P): ProtocolInitializer<Type> {
    return getProtocolInitializer(platform, protocol);
  }

  export async function getWormholeCore(rpc: AptosClient): Promise<WormholeCore<"Aptos">> {
    return getProtocol("WormholeCore").fromRpc(rpc, config);
  }

  export async function getTokenBridge(rpc: AptosClient): Promise<TokenBridge<"Aptos">> {
    return getProtocol("TokenBridge").fromRpc(rpc, config);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: AptosClient,
    tx: string,
  ): Promise<WormholeMessageId[]> {
    const core = await getWormholeCore(rpc);
    return core.parseTransaction(tx);
  }
}
