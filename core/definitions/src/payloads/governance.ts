import {
  platformToChains,
  ProtocolName,
  FixedConversion,
  column,
  constMap,
  Layout,
  RoArray,
} from "@wormhole-foundation/sdk-base";

import { chainItem, universalAddressItem, guardianSetItem } from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

//One thing that's not captured by the payload itself is the fact that governance VAAs should
//  always have Solana as the emitter chain and address bytes32(4) as the emitter address.
//These values are actually magic values though, because governance VAAs are actually created and
//  signed off-chain and are not the result of on-chain observations.
//Additionally their sequence numbers are also chosen at random (and hence tend to be very large).
const actionTuples = [
  [
    "UpgradeContract",
    {
      allowNull: false,
      layout: [{ name: "newContract", ...universalAddressItem }],
    },
  ],
  [
    "RegisterChain",
    {
      allowNull: true,
      layout: [
        { name: "foreignChain", ...chainItem() },
        { name: "foreignAddress", ...universalAddressItem },
      ],
    },
  ],
  //a word on the chainId for RecoverChainId:
  //The contracts accept an arbitrary number when recovering chain ids however I don't think you
  //  ever want to set the wormhole chain id of a contract (even on a fork) to 0 since this would
  //  mean that afterwards all the checks that use `vaa.chainId == this.chainId` in the contract
  //  would suddenly accept "broadcast VAAs" which is almost certainly not what's intended.
  [
    "RecoverChainId",
    {
      //TODO should we define governance actions that are specific to a platform here?
      //     (reason against: we might want to deserialize types that are specific to the platform)
      allowNull: false,
      layout: [
        { name: "evmChainId", binary: "uint", size: 32 },
        {
          name: "newChainId",
          ...chainItem({ allowedChains: platformToChains("Evm") }),
        },
      ],
    },
  ],
  [
    "GuardianSetUpgrade",
    {
      allowNull: true,
      layout: [
        { name: "guardianSet", ...guardianSetItem },
        {
          name: "guardians",
          binary: "array",
          lengthSize: 1,
          layout: { binary: "bytes", size: 20 }, //TODO better (custom) type?
        },
      ],
    },
  ],
  [
    "SetMessageFee",
    {
      allowNull: false,
      layout: [{ name: "messageFee", binary: "uint", size: 32 }],
    },
  ],
  [
    "TransferFees",
    {
      allowNull: true,
      layout: [
        { name: "amount", binary: "uint", size: 32 },
        { name: "recipient", ...universalAddressItem },
      ],
    },
  ],
  [
    "UpdateDefaultProvider",
    {
      allowNull: false,
      layout: [{ name: "defaultProvider", ...universalAddressItem }],
    },
  ],
  [
    "RegisterEmitterAndDomain",
    {
      allowNull: true,
      layout: [
        { name: "emitterChain", ...chainItem() },
        { name: "emitterAddress", ...universalAddressItem },
        { name: "domain", binary: "uint", size: 4 },
      ],
    },
  ],
  [
    "UpdateFinality",
    {
      allowNull: false,
      layout: [{ name: "finality", binary: "uint", size: 1 }],
    },
  ],
] as const satisfies RoArray<readonly [string, { allowNull: boolean; layout: Layout }]>;

const actions = column(actionTuples, 0);
type Action = (typeof actions)[number];

const actionMapping = constMap(actionTuples);

const sdkProtocolNameAndGovernanceVaaModuleEntries = [
  ["WormholeCore", "Core"],
  ["TokenBridge", "TokenBridge"],
  ["NftBridge", "NFTBridge"],
  ["Relayer", "WormholeRelayer"],
  ["CircleBridge", "CircleIntegration"],
] as const satisfies RoArray<readonly [ProtocolName, string]>;

type GovernedProtocols = (typeof sdkProtocolNameAndGovernanceVaaModuleEntries)[number][0];

const sdkProtocolNameToGovernanceVaaModuleMapping = constMap(
  sdkProtocolNameAndGovernanceVaaModuleEntries,
);

const protocolConversion = <P extends GovernedProtocols>(protocol: P) =>
  ({
    to: protocol,
    from: ((): Uint8Array => {
      const moduleBytesSize = 32;
      const bytes = new Uint8Array(moduleBytesSize);
      const vaaModule = sdkProtocolNameToGovernanceVaaModuleMapping(protocol);
      for (let i = 1; i <= vaaModule.length; ++i)
        bytes[moduleBytesSize - i] = vaaModule.charCodeAt(vaaModule.length - i);

      return bytes;
    })(),
  }) as const satisfies FixedConversion<Uint8Array, P>;

const actionConversion = <A extends Action, N extends number>(action: A, num: N) =>
  ({
    to: action,
    from: num,
  }) as const satisfies FixedConversion<N, A>;

const headerLayout = <P extends GovernedProtocols, A extends Action, N extends number>(
  protocol: P,
  action: A,
  num: N,
) =>
  [
    {
      name: "protocol",
      binary: "bytes",
      custom: protocolConversion(protocol),
    },
    {
      name: "action",
      binary: "uint",
      size: 1,
      custom: actionConversion(action, num),
    },
    { name: "chain", ...chainItem(actionMapping(action)) },
  ] as const satisfies Layout;

const governancePayload = <P extends GovernedProtocols, A extends Action, N extends number>(
  protocol: P,
  action: A,
  num: N,
) =>
  [
    action,
    [
      ...headerLayout(protocol, action, num),
      //TODO why is this insane cast necessary here?!
      //     why isn't typescript deducing the return type correctly by itself?
      ...(actionMapping(action).layout as ReturnType<typeof actionMapping<A>>["layout"]),
    ],
  ] as const;

const coreBridgePayloads = [
  //see wormhole ethereum/contracts/GovernanceStructs.sol
  governancePayload("WormholeCore", "UpgradeContract", 1),
  governancePayload("WormholeCore", "GuardianSetUpgrade", 2),
  governancePayload("WormholeCore", "SetMessageFee", 3),
  governancePayload("WormholeCore", "TransferFees", 4),
  governancePayload("WormholeCore", "RecoverChainId", 5),
] as const satisfies NamedPayloads;

const tokenBridgePayloads = [
  //see wormhole ethereum/contracts/bridge/BridgeGovernance.sol
  governancePayload("TokenBridge", "RegisterChain", 1),
  governancePayload("TokenBridge", "UpgradeContract", 2),
  governancePayload("TokenBridge", "RecoverChainId", 3),
] as const satisfies NamedPayloads;

const nftBridgePayloads = [
  //see wormhole ethereum/contracts/nft/NFTBridgeGovernance.sol
  governancePayload("NftBridge", "RegisterChain", 1),
  governancePayload("NftBridge", "UpgradeContract", 2),
  governancePayload("NftBridge", "RecoverChainId", 3),
] as const satisfies NamedPayloads;

const relayerPayloads = [
  //see wormhole ethereum/contracts/relayer/wormholeRelayer/WormholeRelayerGovernance.sol
  governancePayload("Relayer", "RegisterChain", 1),
  governancePayload("Relayer", "UpgradeContract", 2),
  governancePayload("Relayer", "UpdateDefaultProvider", 3),
] as const satisfies NamedPayloads;

const cctpPayloads = [
  //see wormhole-circle-integration evm/src/circle_integration/CircleIntegrationGovernance.sol
  governancePayload("CircleBridge", "UpdateFinality", 1),
  governancePayload("CircleBridge", "RegisterEmitterAndDomain", 2),
  governancePayload("CircleBridge", "UpgradeContract", 3),
] as const satisfies NamedPayloads;

// factory registration:
declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"WormholeCore", typeof coreBridgePayloads>,
        RegisterPayloadTypes<"TokenBridge", typeof tokenBridgePayloads>,
        RegisterPayloadTypes<"NftBridge", typeof nftBridgePayloads>,
        RegisterPayloadTypes<"Relayer", typeof relayerPayloads>,
        RegisterPayloadTypes<"CircleBridge", typeof cctpPayloads> {}
  }
}

registerPayloadTypes("WormholeCore", coreBridgePayloads);
registerPayloadTypes("TokenBridge", tokenBridgePayloads);
registerPayloadTypes("NftBridge", nftBridgePayloads);
registerPayloadTypes("Relayer", relayerPayloads);
registerPayloadTypes("CircleBridge", cctpPayloads);
