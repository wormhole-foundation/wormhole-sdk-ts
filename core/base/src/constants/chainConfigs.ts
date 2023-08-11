import { ChainName, ChainId, toChainId, chains } from "./chains";
import { Platform, chainToPlatform } from "./platforms";
import { Contracts } from "./contracts";
import { ExplorerSettings, explorerConfigs } from "./explorer";
import { finalityThreshold } from "./finality";
import { nativeDecimals } from "./decimals";
import { toMappingFunc } from "../utils";
import { rpcAddress } from "./rpc";
import { Network } from "./networks";

export type ChainConfig = {
  key: ChainName;
  id: ChainId;
  context: Platform;
  contracts: Contracts;
  finalityThreshold: number;
  nativeTokenDecimals: number;
  explorer: ExplorerSettings;
  rpc: string;
};

/*
TODO:
    add missing chains for each config 
 Note: the `ts-ignore`s here are because not every chain
    is represented in the consts we're pulling from yet
*/

type NetworkChainConfigs = {
  [K in ChainName]?: ChainConfig;
};

function combineConfig(n: Network): NetworkChainConfigs {
  const cc: NetworkChainConfigs = chains
    .map((c: ChainName): ChainConfig => {
      return {
        key: c,
        id: toChainId(c),
        context: chainToPlatform(c),
        // @ts-ignore
        finalityThreshold: finalityThreshold(n)[c],
        // @ts-ignore
        nativeDecimals: nativeDecimals(c),
        // @ts-ignore
        explorer: explorerConfigs(n)[c],
        // @ts-ignore
        rpc: rpcAddress(n)[c],
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}

// Combine all the configs for each network/chain
const chainConfigMapping = {
  Mainnet: combineConfig("Mainnet"),
  Testnet: combineConfig("Testnet"),
  Devnet: combineConfig("Devnet"),
} as const satisfies Record<Network, NetworkChainConfigs>;

export const chainConfigs = toMappingFunc(chainConfigMapping);
