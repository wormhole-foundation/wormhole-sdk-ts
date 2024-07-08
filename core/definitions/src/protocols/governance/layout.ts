import type { FixedConversion, Layout, LayoutToType, RoArray, ShallowMapping } from "@wormhole-foundation/sdk-base";
import { column, encoding, constMap, platformToChains, enumItem, calcStaticLayoutSize, deserializeLayout, serializeLayout } from "@wormhole-foundation/sdk-base";

import { modificationKinds } from "./globalAccountant.js";
import { amountItem, chainItem, sequenceItem, fixedLengthStringItem, guardianSetItem, universalAddressItem, stringConversion } from "../../layout-items/index.js";
import type { ProtocolName } from "../../protocol.js";
import type { NamedPayloads, RegisterPayloadTypes } from "../../vaa/index.js";
import { registerPayloadTypes } from "../../vaa/index.js";

//All governance VAAs have a common header:
//  32 bytes protocol name (e.g. Core, TokenBridge, etc.)
//   1 byte  action number (e.g. UpgradeContract, RegisterChain, etc.)
//   2 bytes target chain id - can be 0 if the VAA is valid across all chains
//
//The header is followed by a variable length payload that is specific to the action.
//
//What's not captured by the layouts in here is the fact that governance VAAs always have Solana
//  as the emitter chain and address bytes32(4) as the emitter address.
//These values are actually magic values though, because governance VAAs are in fact created and
//  signed through an off-chain process and are _not_ the result of on-chain an observation.
//Finally, governance VAAs' sequence numbers are chosen at random (and hence tend to be very large).

type ActionTuple = readonly [
  string,  //name of the action
  readonly [
    boolean, //whether the chain id is allowed to be 0 (i.e. the VAA is valid across all chains)
    Layout   //the layout of the action's payload
  ]
];

const rawEvmAddressItem = {
  binary: "bytes",
  size: 20,
  custom: {
    to: (encoded: Uint8Array): string => encoding.hex.encode(encoded, true),
    from: (decoded: string): Uint8Array => encoding.hex.decode(decoded),
  }
} as const;

const contractActions = [
  [ "UpgradeContract", [false, [{ name: "newContract", ...universalAddressItem }]] ],
  [ "RegisterChain", [true,  [
      { name: "foreignChain", ...chainItem() },
      { name: "foreignAddress", ...universalAddressItem },
    ]]
  ],
  //a word on the chainId for RecoverChainId:
  //The EVM contracts accept an arbitrary number when recovering chain ids however I don't think you
  //  ever want to set the wormhole chain id of a contract (even on a fork) to 0 since this would
  //  mean that afterwards all the checks that use `vaa.chainId == this.chainId` in the contract
  //  would suddenly accept "broadcast VAAs" which is almost certainly not what's intended.
  //TODO should we define governance actions that are platform specific here?
  //     (reason against: we might want to deserialize types that are specific to the platform)
  [ "RecoverChainId", [false, [
      { name: "evmChainId", binary: "uint", size: 32 },
      { name: "newChainId", ...chainItem({ allowedChains: platformToChains("Evm") }) },
    ]]
  ],
  [ "GuardianSetUpgrade", [true, [
      { name: "guardianSet", ...guardianSetItem },
      { name: "guardians", binary: "array", lengthSize: 1, layout: rawEvmAddressItem },
    ]]
  ],
  [ "SetMessageFee", [false, [{ name: "messageFee", binary: "uint", size: 32 }]] ],
  [ "TransferFees", [true, [
      { name: "amount", binary: "uint", size: 32 },
      { name: "recipient", ...universalAddressItem },
    ]]
  ],
  [ "UpdateDefaultProvider", [false, [{ name: "defaultProvider", ...universalAddressItem }]] ],
  [ "RegisterEmitterAndDomain", [true, [
      { name: "emitterChain", ...chainItem() },
      { name: "emitterAddress", ...universalAddressItem },
      { name: "domain", binary: "uint", size: 4 },
    ]]
  ],
  [ "UpdateFinality", [false, [{ name: "finality", binary: "uint", size: 1 }]] ],
] as const satisfies RoArray<ActionTuple>;

const wasmHashItem = { binary: "bytes", size: 32 } as const;
const wasmContractLayout = [
  { name: "contractAddr", ...universalAddressItem },
  { name: "codeId", binary: "uint", size: 8 },
] as const;

const wormchainActions = [
  [ "StoreCode", [false, [{ name: "wasmHash", ...wasmHashItem }]] ],
  [ "InstantiateContract", [false, [{ name: "instantiationParamsHash", ...wasmHashItem }]] ],
  [ "MigrateContract", [false, [{ name: "migrationParamsHash", ...wasmHashItem }]] ],
  [ "AddWasmInstantiateAllowlist", [false, wasmContractLayout] ],
  [ "DeleteWasmInstantiateAllowlist", [false,  wasmContractLayout] ],
] as const satisfies RoArray<ActionTuple>;

// The Gateway schedule upgrade action is quite a doozy:
// It has a variable length string that has no length prefix as its first item followed by a uint.
// So deserialization has to reason backwards to determine the length.
// see: https://github.com/wormhole-foundation/wormhole/blob/2eb5cca8e72c5379cd444ae3f25a012c1e04ad65/sdk/vaa/payloads.go#L396-L407
// We have to do a bit of footwork here to accomodate this oddity.
const gatewayScheduleUpgradeItem = (() => {
  const stringBytesLayout = (size: number) =>
    ({ binary: "bytes", size, custom: stringConversion } as const satisfies Layout);
  
  const gsuTailLayout = [
    { name: "height", binary: "uint", size: 8 }
  ] as const satisfies Layout;
  
  const gsuTailSize = calcStaticLayoutSize(gsuTailLayout)!;
  
  const gsuLayout = (size: number) => [
    { name: "name", ...stringBytesLayout(size) },
    ...gsuTailLayout
  ] as const satisfies Layout;
  
  type GatewayScheduleUpgrade = LayoutToType<ReturnType<typeof gsuLayout>>;
  return {
    binary: "bytes",
    custom: {
      to: (encoded: Uint8Array): GatewayScheduleUpgrade =>
        deserializeLayout(gsuLayout(encoded.length - gsuTailSize), encoded),
      from: (decoded: GatewayScheduleUpgrade) =>
        serializeLayout(gsuLayout(decoded.name.length), decoded),
    },
  } as const satisfies Layout;
})();

const gatewayActions = [
  [ "ScheduleUpgrade", [false, gatewayScheduleUpgradeItem] ],
  [ "CancelUpgrade", [true, []] ],
  [ "SetIbcComposabilityMwContract", [false, [
      { name: "contractAddress", ...universalAddressItem },
    ]]
  ],
] as const satisfies RoArray<ActionTuple>;

const globalAccountantActions = [
  [ "ModifyBalance", [false, [
      { name: "sequence", ...sequenceItem },
      { name: "modifiedChain", ...chainItem() },
      { name: "tokenChain", ...chainItem() },
      { name: "tokenAddress", ...universalAddressItem },
      { name: "kind", ...enumItem(modificationKinds) },
      { name: "amount", ...amountItem },
      { name: "reason", ...fixedLengthStringItem(32) }
    ]]
  ],
] as const satisfies RoArray<ActionTuple>;

const ibcReceiverActions = [
  [ "ActionUpdateChannelChain", [false, [
      { name: "channelId", ...fixedLengthStringItem(64) },
      //TODO previous name was "chainId" which is definitely wrong - check new name
      { name: "channelChain", ...chainItem({ allowedChains: platformToChains("Cosmwasm") }) }
    ]]
  ],
] as const satisfies RoArray<ActionTuple>;

const generalPurposeActions = [
  [ "GeneralPurposeEvm", [false, [
      { name: "governanceContract", ...rawEvmAddressItem },
      { name: "targetContract", ...rawEvmAddressItem },
      { name: "payload", binary: "bytes", lengthSize: 2 }
    ]]
  ],  
  [ "GeneralPurposeSolana", [false, [
      { name: "governanceContract", ...universalAddressItem },
      { name: "payload", binary: "bytes" }
    ]]
  ],
] as const satisfies RoArray<ActionTuple>;

const actionTuples = [
  ...contractActions,
  ...wormchainActions,
  ...gatewayActions,
  ...globalAccountantActions,
  ...ibcReceiverActions,
  ...generalPurposeActions,
] as const satisfies RoArray<ActionTuple>;

const actions = column(actionTuples, 0);
type Action = (typeof actions)[number];

const actionMapping = Object.fromEntries(actionTuples) as ShallowMapping<typeof actionTuples>;
type ActionMapping = typeof actionMapping;

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

const sdkProtocolNameToGovernanceVaaModuleMapping =
  constMap(sdkProtocolNameAndGovernanceVaaModuleEntries);

const protocolConversion = <P extends GovernedProtocols>(protocol: P) => ({
  to: protocol,
  from: ((): Uint8Array => {
    const moduleBytesSize = 32;
    const bytes = new Uint8Array(moduleBytesSize);
    const vaaModule = sdkProtocolNameToGovernanceVaaModuleMapping(protocol);
    for (let i = 1; i <= vaaModule.length; ++i)
      bytes[moduleBytesSize - i] = vaaModule.charCodeAt(vaaModule.length - i);

    return bytes;
  })(),
} as const satisfies FixedConversion<Uint8Array, P>);

const actionConversion = <
  const A extends Action,
  const N extends number
>(action: A, num: N) =>  ({
  to: action,
  from: num,
} as const satisfies FixedConversion<N, A>);

const governanceLayout = <P extends GovernedProtocols, A extends Action, N extends number>(
  protocol: P,
  action: A,
  num: N,
) => [
  { name: "protocol", binary: "bytes", custom: protocolConversion(protocol) },
  { name: "action", binary: "uint", size: 1, custom: actionConversion(action, num) },
  { name: "chain", ...chainItem({allowNull: actionMapping[action][0] as ActionMapping[A][0] }) },
  { name: "actionArgs", binary: "bytes", layout: actionMapping[action][1] as ActionMapping[A][1] },
] as const satisfies Layout;

const governancePayload = <P extends GovernedProtocols, A extends Action, N extends number>(
  protocol: P,
  action: A,
  num: N,
) => [action, governanceLayout(protocol, action, num)] as const;

const coreBridgePayloads = [
  //see wormhole ethereum/contracts/GovernanceStructs.sol
  //and wormhole solana/bridge/program/src/types.rs
  governancePayload("WormholeCore", "UpgradeContract", 1),
  governancePayload("WormholeCore", "GuardianSetUpgrade", 2),
  governancePayload("WormholeCore", "SetMessageFee", 3),
  governancePayload("WormholeCore", "TransferFees", 4),
  governancePayload("WormholeCore", "RecoverChainId", 5), //only evm
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
