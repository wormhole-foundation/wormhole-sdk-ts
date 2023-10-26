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
  Network,
  Platform,
  PlatformToChains,
  TxHash,
  WormholeMessageId,
  networkPlatformConfigs,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmChain } from "./chain";
import {
  IbcChannels,
  chainToNativeDenoms,
  networkChainToChannels,
} from "./constants";
import { CosmwasmContracts } from "./contracts";
import { Gateway } from "./gateway";
import { CosmwasmUtils } from "./platformUtils";

import { CosmwasmIbcBridge } from "./protocols/ibc";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";
import { CosmwasmChainName } from "./types";

var _: Platform<"Cosmwasm"> = CosmwasmPlatform;
/**
 * @category Cosmwasm
 */
export module CosmwasmPlatform {
  export const platform = "Cosmwasm";
  export let network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);

  export let contracts: CosmwasmContracts = new CosmwasmContracts(conf);

  export type Type = typeof platform;

  // TODO: re-export all
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
    contracts = new CosmwasmContracts(conf);
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
    const tx = await rpc.getTx(txid);
    if (!tx) throw new Error("No Transaction found: " + txid);
    return [Gateway.parseWormholeMessage(tx)];
  }

  export async function getTokenBridge(
    rpc: CosmWasmClient,
  ): Promise<CosmwasmTokenBridge> {
    return await CosmwasmTokenBridge.fromProvider(rpc, contracts);
  }

  export async function getIbcBridge(
    rpc: CosmWasmClient,
  ): Promise<CosmwasmIbcBridge> {
    return await CosmwasmIbcBridge.fromProvider(rpc, contracts);
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
