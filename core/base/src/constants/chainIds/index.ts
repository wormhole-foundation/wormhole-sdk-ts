import { ChainName } from "../chains";
import { Network } from "../networks";
import { PlatformName, chainToPlatform } from "../platforms";
import { cosmwasmChainIdToNetworkChainPair, cosmwasmNetworkChainToChainId } from "./cosmwasm";
import { evmChainIdToNetworkChainPair, evmNetworkChainToEvmChainId } from "./evm";
import { solGenesisHashToNetworkChainPair, solNetworkChainToGenesisHash } from "./solana";

export function nativeChainId(n: Network, c: ChainName): string {
  const platform = chainToPlatform(c) as PlatformName;
  switch (platform) {
    case "Evm":
      return evmNetworkChainToEvmChainId.get(n, c).toString();
    case "Cosmwasm":
      return cosmwasmNetworkChainToChainId.get(n, c);
    case "Solana":
      return solNetworkChainToGenesisHash.get(n, c);
  }
  throw new Error("Unrecognized platform: " + platform);
}

export function nativeChainIdToChainName(
  platform: PlatformName,
  chainId: string,
): [Network, ChainName] {
  switch (platform) {
    case "Evm":
      return evmChainIdToNetworkChainPair.get(chainId);
    case "Cosmwasm":
      return cosmwasmChainIdToNetworkChainPair.get(chainId);
    case "Solana":
      return solGenesisHashToNetworkChainPair.get(chainId);
  }
  throw new Error("Unrecognized platform: " + platform);
}

export * from "./evm";
export * from "./solana";
export * from "./cosmwasm";
