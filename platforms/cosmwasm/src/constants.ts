import { Network, RoArray, constMap } from "@wormhole-foundation/connect-sdk";
import { CosmwasmChains } from "./types";

export const DEFAULT_FEE = 1_000_000;

export const MSG_EXECUTE_CONTRACT_TYPE_URL = "/cosmwasm.wasm.v1.MsgExecuteContract";

export const IBC_MSG_TYPE = "/ibc.applications.transfer.v1.MsgTransfer";

export const IBC_TRANSFER_PORT = "transfer";

// IBC Message Event type
export const IBC_PACKET_SEND = "send_packet";
export const IBC_PACKET_RECEIVE = "recv_packet";

// Attributes for IBC Packet Event
export const IBC_PACKET_DST = "packet_dst_channel";
export const IBC_PACKET_SRC = "packet_src_channel";
export const IBC_PACKET_SRC_PORT = "packet_src_port";
export const IBC_PACKET_DST_PORT = "packet_dst_port";
export const IBC_PACKET_SEQ = "packet_sequence";
export const IBC_PACKET_DATA = "packet_data";
export const IBC_PACKET_CONN = "packet_connection";

export const IBC_TIMEOUT_MILLIS = 10 * 60 * 1000; // 10 minutes

const cosmwasmAddressPrefix = [
  ["Cosmoshub", "cosmos"],
  ["Evmos", "evmos"],
  ["Injective", "inj"],
  ["Kujira", "kuji"],
  ["Osmosis", "osmo"],
  ["Sei", "sei"],
  ["Terra", "terra"],
  ["Terra2", "terra"],
  ["Wormchain", "wormhole"],
  ["Xpla", "xpla"],
] as const satisfies RoArray<readonly [CosmwasmChains, string]>;

export const chainToAddressPrefix = constMap(cosmwasmAddressPrefix);
export const addressPrefixToChain = constMap(cosmwasmAddressPrefix, [1, [0]]);

const cosmwasmNativeDenom = [
  [
    "Mainnet",
    [
      ["Cosmoshub", "uatom"],
      ["Evmos", "aevmos"],
      ["Injective", "inj"],
      ["Kujira", "kuji"],
      ["Osmosis", "uosmo"],
      ["Sei", "usei"],
      ["Terra", "luna"],
      ["Terra2", "uluna"],
      ["Wormchain", "uworm"],
      ["Xpla", "uxpla"],
    ],
  ],
  [
    "Testnet",
    [
      ["Cosmoshub", "uatom"],
      ["Evmos", "atevmos"],
      ["Injective", "inj"],
      ["Kujira", "kuji"],
      ["Osmosis", "uosmo"],
      ["Sei", "usei"],
      ["Terra", "luna"],
      ["Terra2", "uluna"],
      ["Wormchain", "uworm"],
      ["Xpla", "uxpla"],
    ],
  ],
  [
    "Devnet",
    [
      ["Cosmoshub", "uatom"],
      ["Evmos", "atevmos"],
      ["Injective", "inj"],
      ["Kujira", "kuji"],
      ["Osmosis", "uosmo"],
      ["Sei", "usei"],
      ["Terra", "luna"],
      ["Terra2", "uluna"],
      ["Wormchain", "uworm"],
      ["Xpla", "uxpla"],
    ],
  ],
] as const satisfies RoArray<readonly [Network, RoArray<readonly [CosmwasmChains, string]>]>;

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
  [
    "Devnet",
    [
      ["Injective", "https://localhost:1234"],
      ["Evmos", "https://localhost:1233"],
    ],
  ],
] as const satisfies RoArray<readonly [Network, RoArray<readonly [CosmwasmChains, string]>]>;

export const cosmwasmNetworkChainToRestUrls = constMap(cosmwasmNetworkChainRestUrl);

export type IbcChannels = Partial<Record<CosmwasmChains, string>>;

// For each chain, add the channel id for each other chain
const gatewayConnections = [
  [
    "Mainnet",
    [
      [
        "Wormchain",
        {
          Osmosis: "channel-3",
          Evmos: "channel-5",
          Kujira: "channel-9",
        },
      ],
      ["Osmosis", { Wormchain: "channel-2186" }],
      ["Evmos", { Wormchain: "channel-94" }],
      ["Kujira", { Wormchain: "channel-113" }],
    ],
  ],
  [
    "Testnet",
    [
      ["Wormchain", { Cosmoshub: "channel-5", Osmosis: "channel-9" }],
      ["Cosmoshub", { Wormchain: "channel-3086" }],
      ["Osmosis", { Wormchain: "channel-3906" }],
    ],
  ],
  [
    "Devnet",
    [
      ["Wormchain", { Cosmoshub: "channel-1", Osmosis: "channel-2" }],
      ["Cosmoshub", { Wormchain: "channel-1" }],
      ["Osmosis", { Wormchain: "channel-1" }],
    ],
  ],
] as const satisfies RoArray<readonly [Network, RoArray<readonly [CosmwasmChains, IbcChannels]>]>;

export const networkChainToChannels = constMap(gatewayConnections);

export const evmLikeChains = ["Evmos", "Injective"] as const satisfies RoArray<CosmwasmChains>;
export type CosmwasmEvmChain = (typeof evmLikeChains)[number];
