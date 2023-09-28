import {
  ChainName,
  TxHash,
  WormholeMessageId,
  ChainsConfig,
  networkPlatformConfigs,
  Network,
  DEFAULT_NETWORK,
  Platform,
} from "@wormhole-foundation/connect-sdk";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmContracts } from "./contracts";
import { CosmwasmChain } from "./chain";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";
import { CosmwasmUtils } from "./platformUtils";

// forces CosmwasmPlatform to implement Platform
var _: Platform<"Cosmwasm"> = CosmwasmPlatform

/**
 * @category Cosmwasm
 */
export module CosmwasmPlatform {
  export const platform = "Cosmwasm";
  export let network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);

  let contracts: CosmwasmContracts = new CosmwasmContracts(conf);

  export type Type = typeof platform;

  // TODO: re-export all
  export const {
    nativeTokenId,
    isNativeTokenId,
    isSupportedChain,
    getDecimals,
    getBalance,
    sendWait,
    getCurrentBlock,
    chainFromRpc,
  } = CosmwasmUtils;

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
    return CosmWasmClient.connect(rpcAddress);
  }

  export function getChain(chain: ChainName): CosmwasmChain {
    return new CosmwasmChain(chain);
  }

  export async function getTokenBridge(
    rpc: CosmWasmClient
  ): Promise<CosmwasmTokenBridge> {
    return await CosmwasmTokenBridge.fromProvider(rpc, contracts);
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: CosmWasmClient,
    txid: TxHash
  ): Promise<WormholeMessageId[]> {
    throw new Error("Not implemented");
    //const receipt = await rpc.getTransactionReceipt(txid);

    //if (receipt === null)
    //  throw new Error(`No transaction found with txid: ${txid}`);

    //const coreAddress = this.conf[chain]!.contracts.coreBridge;
    //const coreImpl = this.contracts.getCoreImplementationInterface();

    //return receipt.logs
    //  .filter((l: any) => {
    //    return l.address === coreAddress;
    //  })
    //  .map((log) => {
    //    const { topics, data } = log;
    //    const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
    //    if (parsed === null) return undefined;

    //    const emitterAddress = this.parseAddress(chain, parsed.args.sender);
    //    return {
    //      chain: chain,
    //      emitter: emitterAddress.toUniversalAddress(),
    //      sequence: parsed.args.sequence,
    //    } as WormholeMessageId;
    //  })
    //  .filter(isWormholeMessageId);
  }
}
