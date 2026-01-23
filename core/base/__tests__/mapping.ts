import { describe, expect, it } from "@jest/globals";

import {
  Network,
  PlatformToChains,
  contracts,
  RoArray,
  constMap
} from './../src/index.js';

type ComplexConfig = {
  a: string;
  b: number;
  c: bigint;
};
const channelId = [
  [
    "Mainnet",
    [
      ["Cosmoshub", { a: "a", b: 1, c: BigInt(1) }],
      ["Osmosis", { a: "b", b: 2, c: BigInt(2) }],
    ],
  ],
  [
    "Testnet",
    [
      ["Cosmoshub", { a: "c", b: 3, c: BigInt(3) }],
      ["Osmosis", { a: "d", b: 4, c: BigInt(4) }],
    ],
  ],
] as const satisfies RoArray<
  readonly [
    Network,
    RoArray<readonly [PlatformToChains<"Cosmwasm">, ComplexConfig]>,
  ]
>;

const networkChainCosmwasmChainIds = [
  [
    "Mainnet",
    [
      ["Cosmoshub", "cosmoshub-4"],
      ["Evmos", "evmos_9001-2"],
    ],
  ],
  [
    "Testnet",
    [
      ["Cosmoshub", "theta-testnet-001"],
      ["Evmos", "evmos_9000-4"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [PlatformToChains<"Cosmwasm">, string]>]
>;

describe("Mapping tests", function () {
  it("should correctly create a mapping", function () {
    const cm = constMap(channelId, [0, [1, 2]]);
    const vals = cm("Mainnet");
    expect(vals.length).toEqual(2);
  });
  it("should correctly create a mapping", function () {
    const chainIdToNetworkChainPair = constMap(networkChainCosmwasmChainIds, [2, [0, 1]]);
    const vals = chainIdToNetworkChainPair("evmos_9000-4");
    expect(vals).toEqual(["Testnet", "Evmos"]);
  });
  it("should correctly create a submap", function () {
    const mainMap = constMap(networkChainCosmwasmChainIds);
    const subMap = mainMap.subMap("Mainnet");
    expect(subMap.has("Cosmoshub")).toBeTruthy();
    expect(subMap.has("Evmos")).toBeTruthy();
    expect(subMap.get("Cosmoshub")).toEqual("cosmoshub-4");
    expect(subMap.get("Evmos")).toEqual("evmos_9001-2");
    expect(subMap("Cosmoshub")).toEqual("cosmoshub-4");
    expect(subMap("Evmos")).toEqual("evmos_9001-2");
  });
});

describe("Contract tests", function () {
  const ethereumTokenBridge = contracts.tokenBridge("Mainnet", "Ethereum");
  it("should correctly access values", function () {
    expect(ethereumTokenBridge).toEqual(
      "0x3ee18B2214AFF97000D974cf647E7C347E8fa585"
    );
  });

  it("should get all contracts", function () {
    const n = "Mainnet";
    const c = "Ethereum";

    expect(contracts.coreBridge(n, c)).toBeTruthy();
    expect(contracts.tokenBridge(n, c)).toBeTruthy();
    expect(contracts.nftBridge(n, c)).toBeTruthy();
    expect(contracts.relayer(n, c)).toBeTruthy();

    if (contracts.circleContracts.has(n, c)) {
      expect(contracts.circleContracts(n, c)).toBeTruthy();
    }

    if (contracts.gateway.has(n, c)) {
      expect(contracts.gateway.get(n, c)).toBeTruthy();
    }
  });
});
