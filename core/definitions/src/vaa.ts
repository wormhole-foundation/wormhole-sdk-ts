import {
  hexByteStringToUint8Array,
  Layout,
  LayoutItem,
  LayoutToType,
  serializeLayout,
  deserializeLayout,
  DynamicItemsOfLayout,
  addFixedValues,
  CustomConversion,
  LayoutItemToType,
} from "@wormhole-foundation/sdk-base";

import {
  chainItem,
  universalAddressItem,
  signatureItem,
  sequenceItem,
  guardianSetItem,
} from "./layout-items";

import { keccak256 } from "./utils";

const uint8ArrayConversion = {
  to: (val: Uint8Array) => val,
  from: (val: Uint8Array) => val,
} as const satisfies CustomConversion<Uint8Array, Uint8Array>;

//PayloadLiteralToDescriptionMapping is the compile-time analog/complement to the runtime
//  payload factory. It uses TypeScript's interface merging mechanic to "dynamically" extend known
//  payload types that are declared in different modules. This allows us to have full type safety
//  when constructing payloads via the factory without having to ever declare the mapping of all
//  payloads and their respective layouts in a single place (which, besides being a terrible code
//  smell, would also prevent users of the SDK to register their own payload types!)
declare global {
  namespace Wormhole {
    //effective type: Record<string, Layout | CustomConversion<Uint8Array, any>>
    interface PayloadLiteralToDescriptionMapping {
      Uint8Array: typeof uint8ArrayConversion;
    }
  }
}

type PayloadLiteral = keyof Wormhole.PayloadLiteralToDescriptionMapping;
type DescriptionOf<PL extends PayloadLiteral> =
  Wormhole.PayloadLiteralToDescriptionMapping[PL];

type DescriptionToPayloadItem<D extends DescriptionOf<PayloadLiteral>> =
  D extends CustomConversion<Uint8Array, any>
    ? { name: "payload"; binary: "bytes"; custom: D }
    : D extends Layout
    ? { name: "payload"; binary: "object"; layout: D }
    : never;

export type PayloadLiteralToPayloadType<PL extends PayloadLiteral> =
  DescriptionToPayloadItem<DescriptionOf<PL>> extends LayoutItem
    ? LayoutItemToType<DescriptionToPayloadItem<DescriptionOf<PL>>>
    : never;

const guardianSignatureLayout = [
  { name: "guardianIndex", binary: "uint", size: 1 },
  { name: "signature", ...signatureItem },
] as const satisfies Layout;

const headerLayout = [
  { name: "version", binary: "uint", size: 1, custom: 1, omit: true },
  { name: "guardianSet", ...guardianSetItem },
  {
    name: "signatures",
    binary: "array",
    lengthSize: 1,
    layout: guardianSignatureLayout,
  },
] as const satisfies Layout;

const envelopeLayout = [
  { name: "timestamp", binary: "uint", size: 4 },
  { name: "nonce", binary: "uint", size: 4 },
  { name: "emitterChain", ...chainItem() },
  { name: "emitterAddress", ...universalAddressItem },
  { name: "sequence", ...sequenceItem },
  { name: "consistencyLevel", binary: "uint", size: 1 },
] as const satisfies Layout;

const baseLayout = [...headerLayout, ...envelopeLayout] as const;
type BaseLayout = LayoutToType<typeof baseLayout>;

export interface VAA<PL extends PayloadLiteral = "Uint8Array">
  extends BaseLayout {
  readonly payloadLiteral: PL;
  readonly payload: PayloadLiteralToPayloadType<PL>;
  //TODO various problems with storing the hash here:
  // 1. On EVM the core bridge actually uses the double keccak-ed hash because of an early oversight
  // 2. As discussed on slack, storing memoized values on an object is a smell too
  //kept as is for now to get something usable out there, but this should receive more thought once
  //  the SDK has matured a little further.
  readonly hash: Uint8Array;
}

// type govAA = "CoreBridgeUpgradeContract";
// type MyDescription = DescriptionOf<govAA>
// type MyType = LayoutToType<DescriptionOf<govAA>>;
// type MyVaa = { [K in keyof VAA<govAA>]: VAA<govAA>[K] };
// type Look = MyVaa["signatures"];
// type x = { [K in keyof VAA<"CoreBridgeUpgradeContract">]: VAA<"CoreBridgeUpgradeContract">[K] };

const payloadFactory = new Map<
  PayloadLiteral,
  Layout | CustomConversion<Uint8Array, any>
>();

function getPayloadDescription<PL extends PayloadLiteral>(payloadLiteral: PL) {
  const description = payloadFactory.get(payloadLiteral);
  if (!description)
    throw new Error(`No layout registered for payload type ${payloadLiteral}`);
  return description as DescriptionOf<PL>;
}

const isCustomConversion = (
  val: any
): val is CustomConversion<Uint8Array, any> => val.to !== undefined;

const descriptionToPayloadItem = <PL extends PayloadLiteral>(
  description: DescriptionOf<PL>
): DescriptionToPayloadItem<typeof description> =>
  (isCustomConversion(description)
    ? ({ name: "payload", binary: "bytes", custom: description } as const)
    : ({
        name: "payload",
        binary: "object",
        layout: description as Layout,
      } as const)) as DescriptionToPayloadItem<
    DescriptionOf<PL>
  > satisfies LayoutItem;

const bodyLayout = <PL extends PayloadLiteral>(payloadLiteral: PL) =>
  [
    ...envelopeLayout,
    descriptionToPayloadItem(getPayloadDescription(payloadLiteral)),
  ] as const satisfies Layout;

export const create = <PL extends PayloadLiteral = "Uint8Array">(
  payloadLiteral: PL,
  vaaData: LayoutToType<
    DynamicItemsOfLayout<
      [...typeof baseLayout, DescriptionToPayloadItem<DescriptionOf<PL>>]
    >
  >
): VAA<PL> => {
  const body = bodyLayout(payloadLiteral) as Layout;
  const bodyWithFixed = addFixedValues(
    body,
    //not sure why the unknown cast here is required and why the type isn't inferred correctly
    vaaData as LayoutToType<DynamicItemsOfLayout<typeof body>>
  );
  return {
    payloadLiteral,
    ...addFixedValues(
      headerLayout,
      vaaData as LayoutToType<typeof headerLayout>
    ),
    ...bodyWithFixed,
    hash: keccak256(serializeLayout(body, bodyWithFixed)),
  } as VAA<PL>;
};

export function registerPayloadType<PL extends PayloadLiteral>(
  payloadLiteral: PL,
  payloadSerDe: CustomConversion<Uint8Array, any> | Layout
) {
  if (payloadFactory.has(payloadLiteral))
    throw new Error(`Payload type ${payloadLiteral} already registered`);

  payloadFactory.set(payloadLiteral, payloadSerDe);
}

export const serialize = <PL extends PayloadLiteral>(
  vaa: VAA<PL>
): Uint8Array => {
  const layout = [
    ...baseLayout,
    descriptionToPayloadItem(getPayloadDescription(vaa.payloadLiteral)),
  ];
  return serializeLayout(layout, vaa as LayoutToType<typeof layout>);
};

export function deserialize<PL extends PayloadLiteral>(
  payloadLiteral: PL,
  data: Uint8Array | string
): VAA<PL> {
  if (typeof data === "string") data = hexByteStringToUint8Array(data);

  const [header, bodyOffset] = deserializeLayout(headerLayout, data, 0, false);

  //ensure that guardian signature indicies are unique and in ascending order - see:
  //https://github.com/wormhole-foundation/wormhole/blob/8e0cf4c31f39b5ba06b0f6cdb6e690d3adf3d6a3/ethereum/contracts/Messages.sol#L121
  for (let i = 1; i < header.signatures.length; ++i)
    if (
      header.signatures[i].guardianIndex <=
      header.signatures[i - 1].guardianIndex
    )
      throw new Error(
        "Guardian signatures must be in ascending order of guardian set index"
      );

  const body = deserializeLayout(bodyLayout(payloadLiteral), data, bodyOffset);
  const hash = keccak256(data.slice(bodyOffset));

  return { payloadLiteral, ...header, ...body, hash } as VAA<PL>;
}

export const serializePayload = <PL extends PayloadLiteral>(
  payloadLiteral: PL,
  payload: PayloadLiteralToPayloadType<PL>
) => {
  const description = getPayloadDescription(payloadLiteral);
  return isCustomConversion(description)
    ? description.from(payload)
    : serializeLayout(description as Layout, payload);
};

export const deserializePayload = <PL extends PayloadLiteral>(
  payloadLiteral: PL,
  data: Uint8Array | string
): PayloadLiteralToPayloadType<PL> => {
  const description = getPayloadDescription(payloadLiteral);
  data = typeof data === "string" ? hexByteStringToUint8Array(data) : data;
  return isCustomConversion(description)
    ? description.to(data)
    : deserializeLayout(description as Layout, data);
};

payloadFactory.set("Uint8Array", uint8ArrayConversion);
