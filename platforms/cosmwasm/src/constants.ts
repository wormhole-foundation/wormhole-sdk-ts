import {
  Network,
  PlatformToChains,
  RoArray,
  constMap,
} from "@wormhole-foundation/connect-sdk";

const networkChainCosmwasmChainIds = [
  [
    "Mainnet",
    [
      ["Terra", "columbus-5"],
      ["Terra2", "phoenix-1"],
      ["Xpla", "dimension_37-1"],
      ["Injective", "injective-1"],
      ["Osmosis", "	osmosis-1"],
    ],
  ],
  [
    "Testnet",
    [
      ["Terra2", "pisco-1"],
      ["Sei", "atlantic-1"],
      ["Injective", "injective-888"],
      ["Osmosis", "osmo-test-5"], // Or -4?
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>]
>;

export const cosmwasmChainIdToNetworkChainPair = constMap(
  networkChainCosmwasmChainIds,
  [2, [0, 1]]
);

export const cosmwasmNetworkChainToChainId = constMap(
  networkChainCosmwasmChainIds
);

const cosmwasmAddressPrefix = [
  ["Osmosis", "osmo"],
  ["Wormchain", "wormhole"],
  ["Terra2", "terra"],
  //["Cosmoshub", "cosmos"],
  //["Evmos", "evmos"],
] as const satisfies RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>;

export const chainToAddressPrefix = constMap(cosmwasmAddressPrefix);
export const addressPrefixToChain = constMap(cosmwasmAddressPrefix, [1, [0]]);
