import { RoArray } from "../../utils";
import { ChainName } from "../chains";
import { Network } from "../networks";

export const cctpTokenMessenger = [
  [
    "Mainnet",
    [
      ["Ethereum", "0xbd3fa81b58ba92a82136038b25adec7066af3155"],
      ["Avalanche", "0x6b25532e1060ce10cc3b0a99e5683b91bfde6982"],
    ],
  ],
  [
    "Testnet",
    [
      ["Ethereum", "0xd0c3da58f55358142b8d3e06c1c30c5c6114efe8"],
      ["Avalanche", "0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;
export const cctpMessageTransmitter = [
  [
    "Mainnet",
    [
      ["Ethereum", "0x0a992d191deec32afe36203ad87d7d289a738f81"],
      ["Avalanche", "0x8186359af5f57fbb40c6b14a588d2a59c0c29880"],
    ],
  ],
  [
    "Testnet",
    [
      ["Ethereum", "0x26413e8157cd32011e726065a5462e97dd4d03d9"],
      ["Avalanche", "0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;

export const cctpWormholeRelayer = [
  [
    "Mainnet",
    [
      ["Ethereum", "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2"],
      ["Avalanche", "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2"],
    ],
  ],
  [
    "Testnet",
    [
      ["Ethereum", "0x17da1ff5386d044c63f00747b5b8ad1e3806448d"],
      ["Avalanche", "0x774a70bbd03327c21460b60f25b677d9e46ab458"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;

export const cctpWwormhole = [
  [
    "Mainnet",
    [
      ["Ethereum", "0xAaDA05BD399372f0b0463744C09113c137636f6a"],
      ["Avalanche", "0x09Fb06A271faFf70A651047395AaEb6265265F13"],
    ],
  ],
  [
    "Testnet",
    [
      ["Ethereum", "0x0a69146716b3a21622287efa1607424c663069a4"],
      ["Avalanche", "0x58f4c17449c90665891c42e14d34aae7a26a472e"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;
