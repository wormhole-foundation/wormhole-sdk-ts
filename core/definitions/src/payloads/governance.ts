import {
  platformToChains,
  modules,
  Module,
  FixedConversion,
  column,
  Column,
  toMapping,
  ToMapping,
  Layout,
  Flatten,
  ConcatStringLiterals,
} from "@wormhole-foundation/sdk-base";

import {
  chainItem,
  universalAddressItem,
  guardianSetItem,
} from "../layout-items";
import { registerPayloadType } from "../vaa";

//One thing that's not captures by the payload itself is the fact that governance VAAs should
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
  //The implementation of the contracts accept an arbitrary number when recovering chain ids however
  //  I don't think you ever want to set the wormhole chain id of a contract (even on a fork) to 0
  //  since this would mean that afterwards all the checks that use `vaa.chainId == this.chainId` in
  //  the contract would suddenly accept "broadcast VAAs" which is almost certainly not what's
  //  intended.
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
          layout: [
            { name: "address", binary: "bytes", size: 20 }, //TODO better (custom) type?
          ],
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
] as const satisfies readonly (readonly [
  string,
  { allowNull: boolean; layout: Layout }
])[];

const actions = column(actionTuples, 0);
type Action = (typeof actions)[number];

const actionMapping = toMapping(actionTuples);

const sdkModuleNameAndGovernanceVaaModuleEntries = [
  ["CoreBridge", "Core"],
  ["TokenBridge", "TokenBridge"],
  ["NftBridge", "NFTBridge"],
  ["Relayer", "WormholeRelayer"],
] as const satisfies readonly (readonly [Module, string])[];

const sdkModuleNameToGovernanceVaaModuleMapping = toMapping(
  sdkModuleNameAndGovernanceVaaModuleEntries
);

const moduleToActionToNumTuples = [
  //see https://github.com/wormhole-foundation/wormhole/blob/96c6cc2b325addc2125bb438b228921a4be6b7f3/ethereum/contracts/GovernanceStructs.sol#L64
  [
    "CoreBridge",
    [
      ["UpgradeContract", 1],
      ["GuardianSetUpgrade", 2],
      ["SetMessageFee", 3],
      ["TransferFees", 4],
      ["RecoverChainId", 5],
    ],
  ],
  //see https://github.com/wormhole-foundation/wormhole/blob/96c6cc2b325addc2125bb438b228921a4be6b7f3/ethereum/contracts/bridge/BridgeGovernance.sol#L115
  [
    "TokenBridge",
    [
      ["RegisterChain", 1],
      ["UpgradeContract", 2],
      ["RecoverChainId", 3],
    ],
  ],
  //see https://github.com/wormhole-foundation/wormhole/blob/96c6cc2b325addc2125bb438b228921a4be6b7f3/ethereum/contracts/nft/NFTBridgeGovernance.sol#L112
  [
    "NftBridge",
    [
      ["RegisterChain", 1],
      ["UpgradeContract", 2],
      ["RecoverChainId", 3],
    ],
  ],
  //see https://github.com/wormhole-foundation/wormhole/blob/96c6cc2b325addc2125bb438b228921a4be6b7f3/ethereum/contracts/relayer/wormholeRelayer/WormholeRelayerGovernance.sol#L60
  [
    "Relayer",
    [
      ["RegisterChain", 1],
      ["UpgradeContract", 2],
      ["UpdateDefaultProvider", 3],
    ],
  ],
] as const satisfies readonly (readonly [
  Module,
  readonly (readonly [Action, number])[]
])[];

const [actionToNumMapping, moduleActions] = (() => {
  //that's what you get when your insane programming language doesn't support higher order functions
  //  on types...
  const moduleToActionTuple = toMapping(moduleToActionToNumTuples);
  return [
    toMapping(
      modules.map((module) => [module, toMapping(moduleToActionTuple[module])])
    ) as { readonly [M in Module]: ToMapping<(typeof moduleToActionTuple)[M]> },
    toMapping(
      modules.map((module) => [module, column(moduleToActionTuple[module], 0)])
    ) as {
      readonly [M in Module]: (typeof moduleToActionTuple)[M] extends infer A extends readonly any[]
        ? readonly [...{ [K in keyof A]: A[K][0] }]
        : never;
    },
  ];
})();

type ModuleAction<M extends Module> = (typeof moduleActions)[M][number];

const moduleBytesSize = 32;

const moduleConversion = <M extends Module>(module: M) =>
  ({
    to: module,
    from: ((): Uint8Array => {
      const bytes = new Uint8Array(moduleBytesSize);
      const vaaModule = sdkModuleNameToGovernanceVaaModuleMapping[module];
      for (let i = 1; i <= vaaModule.length; ++i)
        bytes[moduleBytesSize - i] = vaaModule.charCodeAt(vaaModule.length - i);

      return bytes;
    })(),
  } as const satisfies FixedConversion<Uint8Array, M>);

const actionConversion = <M extends Module, const A extends ModuleAction<M>>(
  module: M,
  action: A
) =>
  ({
    to: action,
    from: actionToNumMapping[module][action] as number,
  } as const satisfies FixedConversion<number, A>);

const headerLayout = <M extends Module, const A extends ModuleAction<M>>(
  module: M,
  action: A & Action
) =>
  [
    {
      name: "module",
      binary: "bytes",
      size: moduleBytesSize,
      custom: moduleConversion(module),
    },
    {
      name: "action",
      binary: "uint",
      size: 1,
      custom: actionConversion(module, action),
    },
    { name: "chain", ...chainItem(actionMapping[action]) },
  ] as const;

type GovernancePayloadLayouts = Flatten<
  typeof modules extends infer M
    ? {
        readonly [I in keyof M]: (typeof modules)[I] extends keyof typeof moduleActions
          ? (typeof moduleActions)[(typeof modules)[I]] extends infer A
            ? {
                [J in keyof A]: readonly [
                  ConcatStringLiterals<
                    [
                      (typeof modules)[I],
                      (typeof moduleActions)[(typeof modules)[I]][J]
                    ]
                  >,
                  Flatten<
                    [
                      ReturnType<
                        typeof headerLayout<
                          (typeof modules)[I],
                          (typeof moduleActions)[(typeof modules)[I]][J]
                        >
                      >,
                      (typeof moduleActions)[(typeof modules)[I]][J] extends keyof typeof actionMapping
                        ? (typeof actionMapping)[(typeof moduleActions)[(typeof modules)[I]][J]]["layout"]
                        : never
                    ]
                  >
                ];
              }
            : never
          : never;
      }
    : never
>;

export const governancePayloadLiterals = modules.flatMap((module) =>
  moduleActions[module].map((action) => module + action)
) as readonly string[] as Column<GovernancePayloadLayouts, 0>;

export const governancePayloadLiteralToLayoutMapping = toMapping(
  modules.flatMap((module) =>
    moduleActions[module].map((action) => [
      module + action,
      [...headerLayout(module, action), ...actionMapping[action].layout],
    ])
  ) as readonly (readonly [
    (typeof governancePayloadLiterals)[number],
    Layout
  ])[]
) as ToMapping<GovernancePayloadLayouts>;

export const governanceModuleActions = moduleActions;

//side-effects! finally, register with factory:
declare global {
  namespace Wormhole {
    interface PayloadLiteralToDescriptionMapping
      extends ToMapping<GovernancePayloadLayouts> {}
  }
}

governancePayloadLiterals.forEach((payloadLiteral) =>
  registerPayloadType(
    payloadLiteral,
    governancePayloadLiteralToLayoutMapping[payloadLiteral]
  )
);
