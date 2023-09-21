import {
  ChainName,
  Network,
  PlatformToChains,
  RoArray,
  constMap,
} from "@wormhole-foundation/connect-sdk";

export const MSG_EXECUTE_CONTRACT_TYPE_URL =
  "/cosmwasm.wasm.v1.MsgExecuteContract";
export const IBC_MSG_TYPE = "/ibc.applications.transfer.v1.MsgTransfer";
export const IBC_PORT = "transfer";
export const IBC_TIMEOUT_MILLIS = 10 * 60 * 1000; // 10 minutes

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
  ["Cosmoshub", "cosmos"],
  ["Evmos", "evmos"],
] as const satisfies RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>;

export const chainToAddressPrefix = constMap(cosmwasmAddressPrefix);
export const addressPrefixToChain = constMap(cosmwasmAddressPrefix, [1, [0]]);

const cosmwasmNativeDenom = [
  [
    "Mainnet",
    [
      ["Terra", "uluna"],
      ["Terra2", "uluna"],
      ["Osmosis", "uosmo"],
      ["Wormchain", "uworm"],
      ["Cosmoshub", "uatom"],
      ["Evmos", "aevmos"],
      ["Injective", "inj"],
      ["Kujira", "kuji"],
      ["Sei", "usei"],
      ["Xpla", "uxpla"],
    ],
  ],
  [
    "Testnet",
    [
      ["Terra", "uluna"],
      ["Terra2", "uluna"],
      ["Osmosis", "uosmo"],
      ["Wormchain", "uworm"],
      ["Cosmoshub", "uatom"],
      ["Evmos", "atevmos"],
      ["Injective", "inj"],
      ["Kujira", "kuji"],
      ["Sei", "usei"],
      ["Xpla", "uxpla"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>]
>;

export const chainToNativeDenoms = constMap(cosmwasmNativeDenom);
