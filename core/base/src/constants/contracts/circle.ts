import { MapLevels } from "../../utils";
import { Chain } from "../chains";
import { Network } from "../networks";

export type CircleContracts = {
  tokenMessenger: string;
  messageTransmitter: string;
  wormholeRelayer: string;
  wormhole: string;
};

// prettier-ignore
export const circleContracts = [
  [
    "Mainnet",
    [
      [
        "Arbitrum",
        {
          tokenMessenger: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
          messageTransmitter: "0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
        },
      ],
      [
        "Avalanche",
        {
          tokenMessenger: "0x6b25532e1060ce10cc3b0a99e5683b91bfde6982",
          messageTransmitter: "0x8186359af5f57fbb40c6b14a588d2a59c0c29880",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x09Fb06A271faFf70A651047395AaEb6265265F13",
        },
      ],
      [
        "Ethereum",
        {
          tokenMessenger: "0xbd3fa81b58ba92a82136038b25adec7066af3155",
          messageTransmitter: "0x0a992d191deec32afe36203ad87d7d289a738f81",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0xAaDA05BD399372f0b0463744C09113c137636f6a",
        },
      ],
      [
        "Optimism",
        {
          tokenMessenger: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
          messageTransmitter: "0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
        },
      ],
      [
        "Base",
        {
          tokenMessenger: "",
          messageTransmitter: "",
          wormholeRelayer: "",
          wormhole: "0x03faBB06Fa052557143dC28eFCFc63FC12843f1D",
        },
      ],
    ],
  ],
  [
    "Testnet",
    [
      [
        "Avalanche",
        {
          tokenMessenger: "0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0",
          messageTransmitter: "0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79",
          wormholeRelayer: "0x774a70bbd03327c21460b60f25b677d9e46ab458",
          wormhole: "0x58f4c17449c90665891c42e14d34aae7a26a472e",
        },
      ],
      [
        "Solana",
        {
          tokenMessenger: "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3",
          messageTransmitter: "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd",
          wormholeRelayer: "",
          wormhole: "",
        },
      ],
      [
        "ArbitrumSepolia",
        {
          tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
          messageTransmitter: "0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
        },
      ],
      [
        "Sepolia",
        {
          tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
          messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
        },
      ],
      [
        "OptimismSepolia",
        {
          tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
          messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
        },
      ],
      [
        "BaseSepolia",
        {
          tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
          messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
          wormholeRelayer: "0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2",
          wormhole: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
        },
      ],
    ],
  ],
] as const satisfies MapLevels<[Network, Chain, CircleContracts]>;
