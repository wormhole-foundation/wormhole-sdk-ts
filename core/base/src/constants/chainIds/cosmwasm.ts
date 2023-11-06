import { RoArray, constMap, ChainName, Network } from "../../";

const networkChainCosmwasmChainIds = [
  [
    "Mainnet",
    [
      ["Cosmoshub", "cosmoshub-4"],
      ["Evmos", "evmos_9001-2"],
      ["Injective", "injective-1"],
      ["Osmosis", "osmosis-1"],
      ["Sei", "pacific-1"],
      ["Terra", "columbus-5"],
      ["Terra2", "phoenix-1"],
      ["Wormchain", "wormchain"],
      ["Xpla", "dimension_37-1"],
    ],
  ],
  [
    "Testnet",
    [
      ["Cosmoshub", "theta-testnet-001"],
      ["Evmos", "evmos_9000-4"],
      ["Injective", "injective-888"],
      ["Osmosis", "osmo-test-5"],
      ["Sei", "atlantic-2"],
      ["Terra2", "pisco-1"],
      ["Wormchain", "wormchain-testnet-0"],
      ["Xpla", "cube_47-5"],
    ],
  ],
  [
    "Devnet",
    [
      ["Evmos", "evmos_devnet_fake"],
      ["Injective", "injective_devnet_fake"],
    ],
  ],
] as const satisfies RoArray<readonly [Network, RoArray<readonly [ChainName, string]>]>;

export const cosmwasmChainIdToNetworkChainPair = constMap(networkChainCosmwasmChainIds, [
  2,
  [0, 1],
]);

export const cosmwasmNetworkChainToChainId = constMap(networkChainCosmwasmChainIds);
