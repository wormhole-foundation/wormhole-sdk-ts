import {
  column,
  hexByteStringToUint8Array,
  Layout,
  LayoutItem,
  LayoutToType,
  layoutDiscriminator,
  serializeLayout,
  deserializeLayout,
  DynamicItemsOfLayout,
  addFixedValues,
} from "@wormhole-foundation/sdk-base";

import {
  chainItem,
  universalAddressItem,
  signatureItem,
  sequenceItem,
  guardianSetItem,
} from "./layout-items";

import { keccak256 } from "./utils";

//PayloadLiteralToLayoutMapping is the compile-time analog/complement to the runtime
//  payload factory. It uses TypeScript's interface merging mechanic to "dynamically" extend known
//  payload types that are declared in different modules. This allows us to have full type safety
//  when constructing payloads via the factory without having to ever declare the mapping of all
//  payloads and their respective layouts in a single place (which, besides being a terrible code
//  smell, would also prevent users of the SDK to register their own payload types!)
declare global {
  namespace Wormhole {
    //effective type: Record<string, Layout>
    interface PayloadLiteralToLayoutMapping {}
  }
}

type PayloadLiteral = keyof Wormhole.PayloadLiteralToLayoutMapping & string;
type LayoutOf<PL extends PayloadLiteral> =
  //TODO check if this lazy instantiation hack is actually necessary
  PL extends infer V extends PayloadLiteral
  ? Wormhole.PayloadLiteralToLayoutMapping[V]
  : never;

type PayloadLiteralToPayloadType<PL extends PayloadLiteral> =
  LayoutToType<LayoutOf<PL>>;

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

//envelope + payload are getting hashed and signed
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

type ExtendedLiteral = PayloadLiteral | "Uint8Array";
type ExtendedLiteralToPayloadType<EL extends ExtendedLiteral> =
  EL extends PayloadLiteral
  ? PayloadLiteralToPayloadType<EL>
  : Uint8Array;

export interface VAA<EL extends ExtendedLiteral = ExtendedLiteral>
  extends BaseLayout {
  readonly payloadLiteral: EL;
  readonly payload: ExtendedLiteralToPayloadType<EL>;
  //TODO various problems with storing the hash here:
  // 1. On EVM the core bridge actually uses the double keccak-ed hash because of an early oversight
  // 2. As discussed on slack, storing memoized values on an object is a smell too
  //kept as is for now to get something usable out there, but this should receive more thought once
  //  the SDK has matured a little further.
  readonly hash: Uint8Array;
}

const payloadFactory = new Map<PayloadLiteral, Layout>();

function getPayloadLayout<PL extends PayloadLiteral>(payloadLiteral: PL) {
  const layout = payloadFactory.get(payloadLiteral);
  if (!layout)
    throw new Error(`No layout registered for payload type ${payloadLiteral}`);
  return layout as LayoutOf<PL>;
}

const extendedLiteralToPayloadItem = <EL extends ExtendedLiteral>(
  extendedLiteral: EL,
) => (
  extendedLiteral === "Uint8Array"
  ? { name: "payload", binary: "bytes" } as const
  : { name: "payload", binary: "object", layout: getPayloadLayout(extendedLiteral) } as const
) satisfies LayoutItem;

//annoyingly we can't use the return value of extendedLiteralToPayloadItem
type ExtendedLiteralToDynamicItems<EL extends ExtendedLiteral> =
  DynamicItemsOfLayout<[
    ...typeof baseLayout,
    EL extends PayloadLiteral
    ? { name: "payload", binary: "object", layout: DynamicItemsOfLayout<LayoutOf<EL>> }
    : { name: "payload", binary: "bytes" }
  ]>;

export const create = <EL extends ExtendedLiteral = "Uint8Array">(
  extendedLiteral: EL,
  vaaData: LayoutToType<ExtendedLiteralToDynamicItems<EL>>,
): VAA<EL> => {
  const bodyLayout = [...envelopeLayout, extendedLiteralToPayloadItem(extendedLiteral)] as const;
  const bodyWithFixed = addFixedValues(
    bodyLayout,
    //not sure why the unknown cast here is required and why the type isn't inferred correctly
    vaaData as LayoutToType<DynamicItemsOfLayout<typeof bodyLayout>>,
  );
  return {
    payloadLiteral: extendedLiteral,
    ...addFixedValues(
      headerLayout,
      vaaData as LayoutToType<typeof headerLayout>,
    ),
    ...bodyWithFixed,
    hash: keccak256(serializeLayout(bodyLayout, bodyWithFixed)),
  } as VAA<EL>;
};

export function registerPayloadType<PL extends PayloadLiteral>(
  payloadLiteral: PL,
  payloadLayout: Layout,
) {
  if (payloadFactory.has(payloadLiteral))
    throw new Error(`Payload type ${payloadLiteral} already registered`);

  payloadFactory.set(payloadLiteral, payloadLayout);
}

export const serialize = <EL extends ExtendedLiteral>(vaa: VAA<EL>): Uint8Array => {
  const layout = [
    ...baseLayout,
    extendedLiteralToPayloadItem(vaa.payloadLiteral),
  ] as const satisfies Layout;
  return serializeLayout(layout, vaa as unknown as LayoutToType<typeof layout>);
};

export const serializePayload = <EL extends ExtendedLiteral>(
  extendedLiteral: EL,
  payload: ExtendedLiteralToPayloadType<EL>,
) => {
  if (extendedLiteral === "Uint8Array")
    return payload;

  const layout = getPayloadLayout(extendedLiteral);
  return serializeLayout(layout, payload as LayoutToType<typeof layout>);
}

export type NamedPayloads = readonly (readonly [string, Layout])[];

export const payloadDiscriminator = <NP extends NamedPayloads>(namedPayloads: NP) => {
  const literals = column(namedPayloads, 0);
  const layouts = column(namedPayloads, 1);
  const discriminator = layoutDiscriminator(layouts);

  return (data: Uint8Array | string): (typeof literals)[number] | null => {
    if (typeof data === "string")
      data = hexByteStringToUint8Array(data);

    const index = discriminator(data);
    return index !== null ? literals[index] : null;
  };
};

export function deserialize<EL extends ExtendedLiteral>(
  extendedLiteral: EL,
  data: Uint8Array | string,
): VAA<EL>;

export function deserialize<PL extends PayloadLiteral>(
  discriminator: (data: Uint8Array | string) => PL | null,
  data: Uint8Array | string,
): VAA<PL>;

export function deserialize<EL extends ExtendedLiteral>(
  payloadDet: EL | ((data: Uint8Array | string) => (EL & PayloadLiteral) | null),
  data: Uint8Array | string,
): VAA<EL> {
  if (typeof data === "string") data = hexByteStringToUint8Array(data);

  const [header, envelopeOffset] = deserializeLayout(headerLayout, data, 0, false);

  //ensure that guardian signature indicies are unique and in ascending order - see:
  //https://github.com/wormhole-foundation/wormhole/blob/8e0cf4c31f39b5ba06b0f6cdb6e690d3adf3d6a3/ethereum/contracts/Messages.sol#L121
  for (let i = 1; i < header.signatures.length; ++i)
    if (
      header.signatures[i].guardianIndex <=
      header.signatures[i - 1].guardianIndex
    )
      throw new Error(
        "Guardian signatures must be in ascending order of guardian set index",
      );

  const [envelope, payloadOffset] = deserializeLayout(envelopeLayout, data, envelopeOffset, false);

  const [payloadLiteral, payload] =
    payloadDet === "Uint8Array"
    ? ["Uint8Array", data.slice(payloadOffset)]
    : typeof payloadDet === "string"
    ? [payloadDet, deserializeLayout(getPayloadLayout(payloadDet), data, payloadOffset)]
    : deserializePayload(payloadDet, data, payloadOffset);
  const hash = keccak256(data.slice(envelopeOffset));

  return { payloadLiteral, ...header, ...envelope, payload, hash } as VAA<EL>;
}

type DeserializePayloadReturn<EL extends ExtendedLiteral> =
  ExtendedLiteralToPayloadType<EL> |
  [EL & PayloadLiteral, PayloadLiteralToPayloadType<EL & PayloadLiteral>];

export function deserializePayload<EL extends ExtendedLiteral>(
  payloadLiteral: EL,
  data: Uint8Array | string,
  offset?: number,
): ExtendedLiteralToPayloadType<EL>;

export function deserializePayload<PL extends PayloadLiteral>(
  discriminator: (data: Uint8Array | string) => PL | null,
  data: Uint8Array | string,
  offset?: number,
): [PL, PayloadLiteralToPayloadType<PL>];

export function deserializePayload<EL extends ExtendedLiteral>(
  payloadDet: EL | ((data: Uint8Array | string) => (EL & PayloadLiteral) | null),
  data: Uint8Array | string,
  offset = 0,
): DeserializePayloadReturn<EL> {
  //grouped together to have just a single cast on the return type
  return (() => {
    if (typeof data === "string") data = hexByteStringToUint8Array(data);

    if (payloadDet === "Uint8Array")
      return data.slice(offset);

    if (typeof payloadDet === "string")
      return deserializeLayout(getPayloadLayout(payloadDet), data, offset);

    const candidate = payloadDet(data);
    if (candidate === null)
      throw new Error(`Encoded data does not match any of the given payload types - ${data}`);

    return [candidate, deserializeLayout(getPayloadLayout(candidate), data, offset)];
  })() as DeserializePayloadReturn<EL>;
}
