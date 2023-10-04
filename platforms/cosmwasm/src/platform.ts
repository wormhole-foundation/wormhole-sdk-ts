import {
  IbcExtension,
  QueryClient,
  logs as cosmosLogs,
  setupIbcExtension,
} from "@cosmjs/stargate";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { TendermintClient } from "@cosmjs/tendermint-rpc";

import {
  ChainName,
  TxHash,
  WormholeMessageId,
  ChainsConfig,
  networkPlatformConfigs,
  Network,
  DEFAULT_NETWORK,
  Platform,
  UniversalAddress,
  PlatformToChains,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmContracts } from "./contracts";
import { CosmwasmChain } from "./chain";
import { CosmwasmUtils } from "./platformUtils";
import { chainToNativeDenoms } from "./constants";
import { searchCosmosLogs } from "./types";
import { Gateway } from "./gateway";

import { CosmwasmTokenBridge } from "./protocols/tokenBridge";
import { CosmwasmIbcBridge } from "./protocols/ibc";

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
    sendWait,
    getCurrentBlock,
    chainFromRpc,
  } = CosmwasmUtils;

  export const {
    getRpc: getGatewayRpc,
    getWrappedAsset: getGatewayWrappedAsset,
    address: gatewayAddress,
    getDestinationChannel,
    getSourceChannel,
    ibcTransferPending,
  } = Gateway;

  export function setConfig(
    network: Network,
    _conf?: ChainsConfig
  ): typeof CosmwasmPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    contracts = new CosmwasmContracts(conf);
    return CosmwasmPlatform;
  }

  export async function getRpc(chain: ChainName): Promise<CosmWasmClient> {
    const rpcAddress = conf[chain]!.rpc;
    return await CosmWasmClient.connect(rpcAddress);
  }

  export function getChain(chain: ChainName): CosmwasmChain {
    return new CosmwasmChain(chain);
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
    txid: TxHash
  ): Promise<WormholeMessageId[]> {
    const tx = await rpc.getTx(txid);
    if (!tx) throw new Error("tx not found");

    // parse logs emitted for the tx execution
    const logs = cosmosLogs.parseRawLog(tx.rawLog);

    // extract information wormhole contract logs
    // - message.sequence: the vaa's sequence number
    // - message.sender: the vaa's emitter address
    const sequence = searchCosmosLogs("message.sequence", logs);
    if (!sequence) throw new Error("sequence not found");

    const emitterAddress = searchCosmosLogs("message.sender", logs);
    if (!emitterAddress) throw new Error("emitter not found");

    return [
      {
        chain: chain,
        sequence: BigInt(sequence),
        emitter: new UniversalAddress(emitterAddress),
      },
    ];
  }

  export async function getTokenBridge(
    rpc: CosmWasmClient
  ): Promise<CosmwasmTokenBridge> {
    return await CosmwasmTokenBridge.fromProvider(rpc, contracts);
  }

  export async function getIbcBridge(
    rpc: CosmWasmClient
  ): Promise<CosmwasmIbcBridge> {
    return await CosmwasmIbcBridge.fromProvider(rpc, contracts);
  }

  export const getQueryClient = (
    rpc: CosmWasmClient
  ): QueryClient & IbcExtension => {
    // @ts-ignore
    const tmClient: TendermintClient = rpc.getTmClient()!;
    return QueryClient.withExtensions(tmClient, setupIbcExtension);
  };
}
