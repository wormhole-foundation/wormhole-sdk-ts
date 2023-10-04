import {
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
      ["Cosmoshub", "cosmoshub-4"],
      ["Sei", "pacific-1"],
      ["Evmos", "evmos_9001-2"],
      ["Wormchain", "wormchain"],
      ["Xpla", "dimension_37-1"],
    ],
  ],
  [
    "Testnet",
    [
      ["Terra2", "pisco-1"],
      ["Sei", "atlantic-1"],
      ["Injective", "injective-888"],
      ["Osmosis", "osmo-test-5"],
      ["Cosmoshub", "theta-testnet-001"],
      ["Sei", "atlantic-2"],
      ["Evmos", "evmos_9000-4"],
      ["Wormchain", "wormchain-testnet-0"],
      ["Xpla", "	cube_47-5"],
    ],
  ],
  ["Devnet", []],
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
  ["Injective", "inj"],
  ["Sei", "sei"],
  ["Terra", "terra"], // TODO: make sure this is right
  ["Kujira", "kuji"], // TODO: make sure this is right
  ["Xpla", "xpla"], // TODO: make sure this is right
] as const satisfies RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>;

export const chainToAddressPrefix = constMap(cosmwasmAddressPrefix);
export const addressPrefixToChain = constMap(cosmwasmAddressPrefix, [1, [0]]);

const cosmwasmNativeDenom = [
  [
    "Mainnet",
    [
      ["Terra", "uluna"],
      ["Terra2", "uluna"], // same for both?
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
export const nativeDenomToChain = constMap(cosmwasmNativeDenom, [[0, 2], [1]]);

const cosmwasmNetworkChainRestUrl = [
  [
    "Mainnet",
    [
      ["Injective", "https://lcd.injective.network"],
      ["Evmos", "https://rest.bd.evmos.org:1317"],
    ],
  ],
  [
    "Testnet",
    [
      ["Injective", "https://k8s.testnet.lcd.injective.network"],
      ["Evmos", "https://rest.bd.evmos.dev:1317"],
    ],
  ],
  ["Devnet", []],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>]
>;

export const cosmwasmNetworkChainToRestUrls = constMap(
  cosmwasmNetworkChainRestUrl
);

const channelId = [
  [
    "Mainnet",
    [
      ["Cosmoshub", ["channel-5"]], // TODO: check
      ["Osmosis", ["channel-4"]], // TODO: check
    ],
  ],
  [
    "Testnet",
    [
      ["Cosmoshub", ["channel-5", "channel-3086"]],
      ["Osmosis", ["channel-4", "channel-486"]],
    ],
  ],
  ["Devnet", []],
] as const satisfies RoArray<
  readonly [
    Network,
    RoArray<readonly [PlatformToChains<"Cosmwasm">, RoArray<string>]>
  ]
>;

export const networkChainToChannelId = constMap(channelId);
