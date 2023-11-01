import {
  encoding,
  Layout,
  NamedLayoutItem,
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

//LayoutLiteralToLayoutMapping is the compile-time analog/complement to the runtime
//  payload factory. It uses TypeScript's interface merging mechanic to "dynamically" extend known
//  payload types that are declared in different protocols. This allows us to have full type safety
//  when constructing payloads via the factory without having to ever declare the mapping of all
//  payloads and their respective layouts in a single place (which, besides being a terrible code
//  smell, would also prevent users of the SDK to register their own payload types!)
declare global {
  namespace Wormhole {
    //effective type: Record<string, Layout>
    interface PayloadLiteralToLayoutMapping {}
  }
}

export type LayoutLiteral = keyof Wormhole.PayloadLiteralToLayoutMapping &
  string;
type LayoutOf<LL extends LayoutLiteral> =
  //TODO check if this lazy instantiation hack is actually necessary
  LL extends infer V extends LayoutLiteral
    ? Wormhole.PayloadLiteralToLayoutMapping[V]
    : never;

type LayoutLiteralToPayload<LL extends LayoutLiteral> = LayoutToType<
  LayoutOf<LL>
>;

//we aren't enforcing that Protocol is actually a protocol as to keep things user-extensible
type ProtocolName = string | null;

type ToLiteralFormat<
  PN extends ProtocolName,
  PayloadName extends string,
> = PN extends null ? PayloadName : `${PN}:${PayloadName}`;

type ComposeLiteral<
  ProtocolN extends ProtocolName,
  PayloadN extends string,
  Literal,
> = ToLiteralFormat<ProtocolN, PayloadN> extends infer L extends Literal
  ? L
  : never;

export const composeLiteral = <
  ProtocolN extends ProtocolName,
  PayloadN extends string,
>(
  protocol: ProtocolN,
  payloadName: PayloadN,
) =>
  (protocol ? `${protocol}:${payloadName}` : payloadName) as ComposeLiteral<
    ProtocolN,
    PayloadN,
    PayloadLiteral
  >;

export type PayloadLiteral = LayoutLiteral | "Uint8Array";
export type Payload<PL extends PayloadLiteral> =
  PL extends LayoutLiteral ? LayoutLiteralToPayload<PL> : Uint8Array;

type DecomposeLiteral<PL extends PayloadLiteral> =
  PL extends `${infer Protocol}:${infer LayoutName}`
    ? [Protocol, LayoutName]
    : [null, PL];

const decomposeLiteral = <PL extends PayloadLiteral>(payloadLiteral: PL) => {
  const index = payloadLiteral.indexOf(":");
  return (
    index !== -1
      ? [payloadLiteral.slice(0, index), payloadLiteral.slice(index + 1)]
      : [null, payloadLiteral]
  ) as DecomposeLiteral<PL>;
};

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
    arrayItem: { binary: "object", layout: guardianSignatureLayout },
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

export interface VAA<PL extends PayloadLiteral = PayloadLiteral>
  extends BaseLayout {
  readonly protocolName: DecomposeLiteral<PL>[0];
  readonly payloadName: DecomposeLiteral<PL>[1];
  readonly payloadLiteral: PL;
  readonly payload: Payload<PL>;
  //TODO various problems with storing the hash here:
  // 1. On EVM the core bridge actually uses the double keccak-ed hash because of an early oversight
  // 2. As discussed on slack, storing memoized values on an object is a smell too
  //kept as is for now to get something usable out there, but this should receive more thought once
  //  the SDK has matured a little further.
  readonly hash: Uint8Array;
}

//We enforce distribution over union types, e.g. have
//    ProtocolVAA<"TokenBridge", "Transfer" | "TransferWithPayload">
//  turned into
//    VAA<"TokenBridge:Transfer"> | VAA<"TokenBridge:TransferWithPayload">
//  rather than
//    VAA<"TokenBridge:Transfer" | "TokenBridge:TransferWithPayload">
//  because while the latter is considered more idiomatic/canonical, it actually interferes with
//  the most natural way to narrow VAAs via querying the payloadName or payloadLiteral.
//  (Thanks for absolutely nothing, Typescript).
//  For example, given the TokenBridge VAA union example:
//  if (vaa.payloadName === "Transfer")
//    typeof vaa //no narrowing - still resolves to the union type when using the latter approach
export type DistributiveVAA<PL extends PayloadLiteral> =
  PL extends PayloadLiteral ? VAA<PL> : never;

export type ProtocolVAA<
  PN extends ProtocolName,
  PayloadName extends string,
> = ComposeLiteral<PN, PayloadName, PayloadLiteral> extends infer PL extends
  PayloadLiteral
  ? DistributiveVAA<PL>
  : never;

export type DistributivePayload<PL extends PayloadLiteral> =
  PL extends PayloadLiteral ? Payload<PL> : never;

export type ProtocolPayload<
  PN extends ProtocolName,
  PayloadName extends string,
> = ComposeLiteral<PN, PayloadName, PayloadLiteral> extends infer PL extends PayloadLiteral
  ? DistributivePayload<PL>
  : never;

const payloadFactory = new Map<LayoutLiteral, Layout>();

function getPayloadLayout<LL extends LayoutLiteral>(layoutLiteral: LL) {
  const layout = payloadFactory.get(layoutLiteral);
  if (!layout)
    throw new Error(`No layout registered for payload type ${layoutLiteral}`);
  return layout as LayoutOf<LL>;
}

const payloadLiteralToPayloadItem = <PL extends PayloadLiteral>(
  payloadLiteral: PL,
) =>
  (payloadLiteral === "Uint8Array"
    ? ({ name: "payload", binary: "bytes" } as const)
    : ({
        name: "payload",
        binary: "object",
        layout: getPayloadLayout(payloadLiteral),
      } as const)) satisfies NamedLayoutItem;

//annoyingly we can't use the return value of payloadLiteralToPayloadItem
type PayloadLiteralToDynamicItems<PL extends PayloadLiteral> =
  DynamicItemsOfLayout<
    [
      ...typeof baseLayout,
      PL extends LayoutLiteral
        ? {
            name: "payload";
            binary: "object";
            layout: DynamicItemsOfLayout<LayoutOf<PL>>;
          }
        : { name: "payload"; binary: "bytes" },
    ]
  >;

export function createVAA<PL extends PayloadLiteral = "Uint8Array">(
  payloadLiteral: PL,
  vaaData: LayoutToType<PayloadLiteralToDynamicItems<PL>>,
): VAA<PL> {
  const [protocolName, payloadName] = decomposeLiteral(payloadLiteral);
  const bodyLayout = [
    ...envelopeLayout,
    payloadLiteralToPayloadItem(payloadLiteral),
  ] as const;
  const bodyWithFixed = addFixedValues(
    bodyLayout,
    //not sure why the unknown cast here is required and why the type isn't inferred correctly
    vaaData as LayoutToType<DynamicItemsOfLayout<typeof bodyLayout>>,
  );
  return {
    protocolName,
    payloadName,
    payloadLiteral,
    ...addFixedValues(
      headerLayout,
      vaaData as LayoutToType<typeof headerLayout>,
    ),
    ...bodyWithFixed,
    hash: keccak256(serializeLayout(bodyLayout, bodyWithFixed)),
  } as VAA<PL>;
}

export function registerPayloadType(
  protocol: ProtocolName,
  name: string,
  layout: Layout,
) {
  const payloadLiteral = composeLiteral(protocol, name);
  if (payloadFactory.has(payloadLiteral))
    throw new Error(`Payload type ${payloadLiteral} already registered`);

  payloadFactory.set(payloadLiteral, layout);
}

type AtLeast1<T> = readonly [T, ...T[]];
type AtLeast2<T> = readonly [T, T, ...T[]];

export type NamedPayloads = AtLeast1<readonly [string, Layout]>;
export type RegisterPayloadTypes<
  ProtocolN extends ProtocolName,
  NP extends NamedPayloads,
> = { readonly [E in NP[number] as ToLiteralFormat<ProtocolN, E[0]>]: E[1] };

export function registerPayloadTypes(
  protocol: ProtocolName,
  payloads: NamedPayloads,
) {
  for (const [name, layout] of payloads)
    registerPayloadType(protocol, name, layout);
}

export function serialize<PL extends PayloadLiteral>(vaa: VAA<PL>): Uint8Array {
  const layout = [
    ...baseLayout,
    payloadLiteralToPayloadItem(vaa.payloadLiteral),
  ] as const satisfies Layout;
  return serializeLayout(layout, vaa as unknown as LayoutToType<typeof layout>);
}

export function serializePayload<PL extends PayloadLiteral>(
  payloadLiteral: PL,
  payload: Payload<PL>,
) {
  if (payloadLiteral === "Uint8Array") return payload as Uint8Array;

  const layout = getPayloadLayout(payloadLiteral);
  return serializeLayout(layout, payload as LayoutToType<typeof layout>);
}

//string assumed to be in hex format
export type Byteish = Uint8Array | string;

export type PayloadDiscriminator<
  LL extends LayoutLiteral = LayoutLiteral,
  AllowAmbiguous extends boolean = false,
> = (data: Byteish) => AllowAmbiguous extends false ? LL | null : readonly LL[];

type PayloadGroup = readonly [ProtocolName, AtLeast1<string>];
type PayloadGroupToLayoutLiterals<PG extends PayloadGroup> = ComposeLiteral<
  PG[0],
  PG[1][number],
  LayoutLiteral
>;
type PayloadGroupsToLayoutLiteralsRecursive<
  PGA extends readonly PayloadGroup[],
> = PGA extends readonly [
  infer PG extends PayloadGroup,
  ...infer T extends readonly PayloadGroup[],
]
  ? PayloadGroupToLayoutLiterals<PG> | PayloadGroupsToLayoutLiteralsRecursive<T>
  : never;
type PayloadGroupsToLayoutLiterals<PGA extends readonly PayloadGroup[]> =
  PayloadGroupsToLayoutLiteralsRecursive<PGA> extends infer Value extends
    LayoutLiteral
    ? Value
    : never;

type LLDtoLLs<
  LLD extends
    | AtLeast2<LayoutLiteral>
    | readonly [ProtocolName, AtLeast2<string>]
    | AtLeast2<PayloadGroup>,
> = LLD extends AtLeast2<LayoutLiteral>
  ? LLD[number]
  : LLD extends readonly [ProtocolName, AtLeast2<string>]
  ? PayloadGroupToLayoutLiterals<LLD>
  : LLD extends AtLeast2<PayloadGroup>
  ? PayloadGroupsToLayoutLiterals<LLD>
  : never;

export function payloadDiscriminator<
  const LLD extends
    | AtLeast2<LayoutLiteral>
    | readonly [ProtocolName, AtLeast2<string>]
    | AtLeast2<PayloadGroup>,
  B extends boolean = false,
>(
  payloadLiterals: LLD,
  allowAmbiguous?: B,
): PayloadDiscriminator<LLDtoLLs<LLD>, B> {
  const literals = (() => {
    if (Array.isArray(payloadLiterals[0]))
      return (payloadLiterals as AtLeast2<PayloadGroup>).flatMap(
        ([protocol, payloadNames]) =>
          payloadNames.map((name) => composeLiteral(protocol, name)),
      );

    if (typeof payloadLiterals[1] === "string")
      return payloadLiterals as AtLeast2<LayoutLiteral>;

    const [protocol, payloadNames] = payloadLiterals as readonly [
      ProtocolName,
      AtLeast2<LayoutLiteral>,
    ];
    return payloadNames.map((name) => composeLiteral(protocol, name));
  })();

  const discriminator = layoutDiscriminator(
    literals.map((literal) => getPayloadLayout(literal)),
    !!allowAmbiguous,
  );

  return ((data: Byteish) => {
    if (typeof data === "string") data = encoding.hex.decode(data);

    const cands = discriminator(data);
    return Array.isArray(cands)
      ? cands.map((c) => literals[c])
      : cands !== null
      ? literals[cands as number]
      : null;
  }) as PayloadDiscriminator<LLDtoLLs<LLD>, B>;
}

export type ExtractLiteral<T> = T extends PayloadDiscriminator<infer LL>
  ? LL
  : T;

export function deserialize<T extends PayloadLiteral | PayloadDiscriminator>(
  payloadDet: T,
  data: Byteish,
): DistributiveVAA<ExtractLiteral<T>> {
  if (typeof data === "string") data = encoding.hex.decode(data);

  const [header, envelopeOffset] = deserializeLayout(
    headerLayout,
    data,
    0,
    false,
  );

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

  const [envelope, payloadOffset] = deserializeLayout(
    envelopeLayout,
    data,
    envelopeOffset,
    false,
  );

  const [payloadLiteral, payload] =
    typeof payloadDet === "string"
      ? [
          payloadDet as PayloadLiteral,
          deserializePayload(payloadDet as PayloadLiteral, data, payloadOffset),
        ]
      : deserializePayload(
          payloadDet as PayloadDiscriminator,
          data,
          payloadOffset,
        );
  const [protocolName, payloadName] = decomposeLiteral(payloadLiteral);
  const hash = keccak256(data.slice(envelopeOffset));

  return {
    protocolName,
    payloadName,
    payloadLiteral,
    ...header,
    ...envelope,
    payload,
    hash,
  } satisfies VAA as DistributiveVAA<ExtractLiteral<T>>;
}

type DeserializedPair<LL extends LayoutLiteral = LayoutLiteral> =
  //enforce distribution over union types so we actually get matching pairs
  //  i.e. [LL1, LayoutLiteralToPayload<LL1>] | [LL2, LayoutLiteralToPayload<LL2>] | ...
  //  instead of [LL1 | LL2, LayoutLiteralToPayload<LL1 | LL2>]
  LL extends LayoutLiteral ? readonly [LL, LayoutLiteralToPayload<LL>] : never;

type DeserializePayloadReturn<T> = T extends PayloadLiteral
  ? Payload<T>
  : T extends PayloadDiscriminator<infer LL>
  ? DeserializedPair<LL>
  : never;

export function deserializePayload<
  T extends PayloadLiteral | PayloadDiscriminator,
>(payloadDet: T, data: Byteish, offset = 0): DeserializePayloadReturn<T> {
  //grouped together to have just a single cast on the return type
  return (() => {
    if (typeof data === "string") data = encoding.hex.decode(data);

    if (payloadDet === "Uint8Array") return data.slice(offset);

    if (typeof payloadDet === "string")
      return deserializeLayout(getPayloadLayout(payloadDet), data, offset);

    //kinda unfortunate that we have to slice here, future improvement would be passing an optional
    //  offset to the discriminator
    const candidate = payloadDet(data.slice(offset));
    if (candidate === null)
      throw new Error(
        `Encoded data does not match any of the given payload types - ${data}`,
      );

    return [
      candidate,
      deserializeLayout(getPayloadLayout(candidate), data, offset),
    ];
  })() as DeserializePayloadReturn<T>;
}

export const blindDeserializePayload = (() => {
  const rebuildDiscrimininator = () => {
    const layoutLiterals = Array.from(payloadFactory.keys());
    const layouts = layoutLiterals.map((l) => payloadFactory.get(l)!);
    return [layoutLiterals, layoutDiscriminator(layouts, true)] as const;
  };

  let layoutLiterals = [] as LayoutLiteral[];
  let discriminator = (_: Uint8Array) => [] as readonly number[];

  return (data: Byteish): readonly DeserializedPair[] => {
    if (payloadFactory.size !== layoutLiterals.length)
      [layoutLiterals, discriminator] = rebuildDiscrimininator();

    if (typeof data === "string") data = encoding.hex.decode(data);

    const candidates = discriminator(data).map((c) => layoutLiterals[c]);
    return candidates.reduce((acc, literal) => {
      try {
        acc.push([
          literal,
          deserializePayload(literal, data),
        ] as DeserializedPair);
      } catch {}
      return acc;
    }, [] as DeserializedPair[]);
  };
})();
