import type { FixedConversion, Layout, RoArray } from "@wormhole-foundation/sdk-base";
import { column, constMap, platformToChains, } from "@wormhole-foundation/sdk-base";

import { accountantModificationKindLayoutItem } from "./globalAccountant.js";
import { amountItem, chainItem, fixedLengthStringItem, guardianSetItem, universalAddressItem } from "../../layout-items/index.js";
import type { ProtocolName } from "../../protocol.js";
import type { NamedPayloads, RegisterPayloadTypes } from "../../vaa/index.js";
import { registerPayloadTypes } from "../../vaa/index.js";

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

  // wormchain cosmwasm
  [
    "StoreCode",
    {
      allowNull: false,
      layout: [{ name: "wasmHash", binary: "bytes", size: 32 }]
    }
  ],
  [
    "InstantiateContract",
    {
      allowNull: false,
      layout: [{ name: "instantiationParamsHash", binary: "bytes", size: 32 }]
    }
  ],
  [
    "MigrateContract",
    {
      allowNull: false,
      layout: [{ name: "migrationParamsHash", binary: "bytes", size: 32 }]
    }
  ],
  [
    "AddWasmInstantiateAllowlist",
    {
      allowNull: false,
      layout: [
        { name: "contractAddr", ...universalAddressItem },
        { name: "codeId", binary: "uint", size: 8 }
      ]
    }
  ],
  [
    "DeleteWasmInstantiateAllowlist",
    {
      allowNull: false,
      layout: [
        { name: "contractAddr", ...universalAddressItem },
        { name: "codeId", binary: "uint", size: 8 }
      ]
    }
  ],

  // gateway
  [
    "ScheduleUpgrade",
    {
      allowNull: false,
      layout: [
        // TODO: it's a string, but it's not length prefixed,
        // deserializing relies on the fact that the last 8 bytes is the height
        { name: "name", ...fixedLengthStringItem(32) },
        { name: "height", binary: "uint", size: 8 },
      ]
    }
  ],
  [
    "CancelUpgrade",
    {
      allowNull: true,
      layout: []
    }
  ],
  [
    "SetIbcComposabilityMwContract",
    {
      allowNull: false,
      layout: [
        { name: "contractAddress", ...universalAddressItem }
      ]
    }
  ],

  // global accountant
  [
    "ModifyBalance",
    {
      allowNull: false,
      layout: [
        { name: "sequence", binary: "uint", size: 8 },
        { name: "modifiedChain", ...chainItem() },
        { name: "tokenChain", ...chainItem() },
        { name: "tokenAddress", ...universalAddressItem },
        {
          name: "kind",
          ...accountantModificationKindLayoutItem
        },
        { name: "amount", ...amountItem },
        { name: "reason", ...fixedLengthStringItem(32) }
      ]
    }
  ],

  // ibc receiver/translator
  [
    "ActionUpdateChannelChain",
    {
      allowNull: false,
      layout: [
        { name: "channelId", ...fixedLengthStringItem(64) },
        { name: "chainId", ...chainItem({ allowedChains: platformToChains("Cosmwasm") }) }
      ]
    }
  ],

  // general purpose
  [
    "GeneralPurposeEvm",
    {
      allowNull: false,
      layout: [
        // Address from go-ethereum is 20 bytes
        { name: "governanceContract", ...universalAddressItem, size: 20 },
        { name: "targetContract", ...universalAddressItem, size: 20 },
        { name: "payload", binary: "bytes", lengthSize: 2 }
      ]
    }
  ],  
  [
    "GeneralPurposeSolana",
    {
      allowNull: false,
      layout: [
        { name: "governanceContract", ...universalAddressItem },
        { name: "payload", binary: "bytes" }
      ]
    }
  ],
] as const satisfies RoArray<readonly [string, { allowNull: boolean; layout: Layout }]>;

const actions = column(actionTuples, 0);
type Action = (typeof actions)[number];

const actionMapping = constMap(actionTuples);

const sdkProtocolNameAndGovernanceVaaModuleEntries = [
  ["WormholeCore", "Core"],
  ["TokenBridge", "TokenBridge"],
  ["NftBridge", "NftBridge"],
  ["Relayer", "WormholeRelayer"],
  ["CircleBridge", "CircleIntegration"],
  ["IbcBridge", "IbcTranslator"],
  ["IbcReceiver", "IbcReceiver"],
  ["GlobalAccountant", "GlobalAccountant"],
  ["GeneralPurposeGovernance", "GeneralPurposeGovernance"],
  ["WormchainGovernance", "WasmdModule"],
  ["GatewayGovernance", "GatewayModule"]
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

const ibcBridgePayloads = [
  //see wormhole cosmwasm/contracts/ibc-translator/src/execute.rs submit_update_chain_to_channel_map
  governancePayload("IbcBridge", "ActionUpdateChannelChain", 1),
] as const satisfies NamedPayloads;

const ibcReceiverPayloads = [
  //see wormhole cosmwasm/contracts/wormchain-ibc-receiver/src/contract.rs
  governancePayload("IbcReceiver", "ActionUpdateChannelChain", 1),
] as const satisfies NamedPayloads;

const globalAccountantPayloads = [
  //see wormhole cosmwasm/contracts/global-accountant/src/contract.rs handle_accountant_governance_vaa
  governancePayload("GlobalAccountant", "ModifyBalance", 1),
] as const satisfies NamedPayloads;

const generalPurposeGovernancePayloads = [
  governancePayload("GeneralPurposeGovernance", "GeneralPurposeEvm", 1),
  governancePayload("GeneralPurposeGovernance", "GeneralPurposeSolana", 2),
] as const satisfies NamedPayloads;

const wormchainGovernancePayloads = [
  //see wormhole wormchain/x/wormhole/keeper/msg_server_wasmd.go
  governancePayload("WormchainGovernance", "StoreCode", 1),
  governancePayload("WormchainGovernance", "InstantiateContract", 2),
  governancePayload("WormchainGovernance", "MigrateContract", 3),
  //see wormhole wormchain/x/wormhole/keeper/msg_server_wasm_instantiate_allowlist.go
  governancePayload("WormchainGovernance", "AddWasmInstantiateAllowlist", 4),
  governancePayload("WormchainGovernance", "DeleteWasmInstantiateAllowlist", 5),
] as const satisfies NamedPayloads;

const gatewayGovernancePayloads = [
  //see wormhole wormchain/x/wormhole/keeper/msg_server_execute_gateway_governance_vaa.go
  governancePayload("GatewayGovernance", "ScheduleUpgrade", 1),
  governancePayload("GatewayGovernance", "CancelUpgrade", 2),
  governancePayload("GatewayGovernance", "SetIbcComposabilityMwContract", 3),
] as const satisfies NamedPayloads;

// factory registration:
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"WormholeCore", typeof coreBridgePayloads>,
        RegisterPayloadTypes<"TokenBridge", typeof tokenBridgePayloads>,
        RegisterPayloadTypes<"NftBridge", typeof nftBridgePayloads>,
        RegisterPayloadTypes<"Relayer", typeof relayerPayloads>,
        RegisterPayloadTypes<"CircleBridge", typeof cctpPayloads>,
        RegisterPayloadTypes<"IbcBridge", typeof ibcBridgePayloads>,
        RegisterPayloadTypes<"IbcReceiver", typeof ibcReceiverPayloads>,
        RegisterPayloadTypes<"GlobalAccountant", typeof globalAccountantPayloads>,
        RegisterPayloadTypes<"GeneralPurposeGovernance", typeof generalPurposeGovernancePayloads>,
        RegisterPayloadTypes<"WormchainGovernance", typeof wormchainGovernancePayloads>,
        RegisterPayloadTypes<"GatewayGovernance", typeof gatewayGovernancePayloads>
        {}
  }
}

registerPayloadTypes("WormholeCore", coreBridgePayloads);
registerPayloadTypes("TokenBridge", tokenBridgePayloads);
registerPayloadTypes("NftBridge", nftBridgePayloads);
registerPayloadTypes("Relayer", relayerPayloads);
registerPayloadTypes("CircleBridge", cctpPayloads);
registerPayloadTypes("IbcBridge", ibcBridgePayloads);
registerPayloadTypes("IbcReceiver", ibcReceiverPayloads);
registerPayloadTypes("GlobalAccountant", globalAccountantPayloads);
registerPayloadTypes("GeneralPurposeGovernance", generalPurposeGovernancePayloads);
registerPayloadTypes("WormchainGovernance", wormchainGovernancePayloads);
registerPayloadTypes("GatewayGovernance", gatewayGovernancePayloads);
