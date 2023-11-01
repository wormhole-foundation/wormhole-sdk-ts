import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  BankExtension,
  IbcExtension,
  QueryClient,
  setupBankExtension,
  setupIbcExtension,
} from "@cosmjs/stargate";
import { TendermintClient } from "@cosmjs/tendermint-rpc";

import {
  ChainName,
  ChainsConfig,
  DEFAULT_NETWORK,
  IbcBridge,
  Network,
  Platform,
  PlatformToChains,
  ProtocolInitializer,
  ProtocolName,
  TokenBridge,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  getProtocolInitializer,
  networkPlatformConfigs,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmChain } from "./chain";
import {
  IbcChannels,
  chainToNativeDenoms,
  networkChainToChannels,
} from "./constants";
import { Gateway } from "./gateway";
import { CosmwasmUtils } from "./platformUtils";
import { CosmwasmChainName } from "./types";

var _: Platform<"Cosmwasm"> = CosmwasmPlatform;
/**
 * @category Cosmwasm
 */
export module CosmwasmPlatform {
  export const platform = "Cosmwasm";
  export let network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);
  export type Type = typeof platform;

  export const {
    nativeTokenId,
    isNativeTokenId,
    isNativeDenom,
    isSupportedChain,
    getDecimals,
    getBalance,
    getBalances,
    sendWait,
    getCurrentBlock,
    chainFromChainId,
    chainFromRpc,
  } = CosmwasmUtils;

  export const {
    getRpc: getGatewayRpc,
    getWrappedAsset: getGatewayWrappedAsset,
    gatewayAddress,
    getGatewaySourceChannel,
  } = Gateway;

  export function setConfig(
    _network: Network,
    _conf?: ChainsConfig,
  ): typeof CosmwasmPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    network = _network;
    return CosmwasmPlatform;
  }

  export async function getRpc(chain: ChainName): Promise<CosmWasmClient> {
    const rpcAddress = conf[chain]!.rpc;
    return await CosmWasmClient.connect(rpcAddress);
  }

  export function getChain(chain: ChainName): CosmwasmChain {
    if (chain in conf) return new CosmwasmChain(conf[chain]!);
    throw new Error("No configuration available for chain: " + chain);
  }

  export function getProtocol<PN extends ProtocolName>(
    protocol: PN,
  ): ProtocolInitializer<Type> {
    return getProtocolInitializer(platform, protocol);
  }

  export async function getWormholeCore(
    rpc: CosmWasmClient,
  ): Promise<WormholeCore<"Cosmwasm">> {
    return getProtocol("WormholeCore").fromRpc(rpc, conf);
  }
  export async function getTokenBridge(
    rpc: CosmWasmClient,
  ): Promise<TokenBridge<"Cosmwasm">> {
    return getProtocol("TokenBridge").fromRpc(rpc, conf);
  }

  export async function getIbcBridge(
    rpc: CosmWasmClient,
  ): Promise<IbcBridge<"Cosmwasm">> {
    return await getProtocol("IbcBridge").fromRpc(rpc, conf);
  }

  // TODO: should other platforms have something like this?
  export function getNativeDenom(chain: ChainName): string {
    // TODO: required because of const map
    if (network === "Devnet") throw new Error("No devnet native denoms");
    return chainToNativeDenoms(network, chain as PlatformToChains<Type>);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: CosmWasmClient,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    const core = await getWormholeCore(rpc);
    return core.parseTransaction(txid);
  }

  export const getQueryClient = (
    rpc: CosmWasmClient,
  ): QueryClient & BankExtension & IbcExtension => {
    // @ts-ignore
    const tmClient: TendermintClient = rpc.getTmClient()!;
    return QueryClient.withExtensions(
      tmClient,
      setupBankExtension,
      setupIbcExtension,
    );
  };

  // cached channels from config if available
  export const getIbcChannels = (
    chain: CosmwasmChainName,
  ): IbcChannels | null => {
    return networkChainToChannels.has(network, chain)
      ? networkChainToChannels.get(network, chain)!
      : null;
  };
}
