import {
  encoding,
  Layout,
  LayoutToType,
  layoutDiscriminator,
  serializeLayout,
  deserializeLayout,
} from "@wormhole-foundation/sdk-base";

import {
  LayoutLiteral,
  PayloadLiteral,
  LayoutOf,
  ProtocolName,
  ComposeLiteral,
  composeLiteral,
  payloadFactory,
} from "./registration";

import {
  VAA,
  DistributiveVAA,
  Payload,
  LayoutLiteralToPayload,
  decomposeLiteral,
  headerLayout,
  envelopeLayout,
  baseLayout,
} from "./vaa";

import { keccak256 } from "../utils";

export function getPayloadLayout<LL extends LayoutLiteral>(layoutLiteral: LL) {
  const layout = payloadFactory.get(layoutLiteral);
  if (!layout) throw new Error(`No layout registered for payload type ${layoutLiteral}`);
  return layout as LayoutOf<LL>;
}

//annoyingly we can't implicitly declare this using the return type of payloadLiteralToPayloadItem
export type PayloadLiteralToPayloadItemLayout<PL extends PayloadLiteral> = PL extends infer V
  ? V extends LayoutLiteral
    ? [{ name: "payload"; binary: "object"; layout: LayoutOf<V> }]
    : V extends "Uint8Array"
    ? [{ name: "payload"; binary: "bytes" }]
    : never
  : never;

export function payloadLiteralToPayloadItemLayout<PL extends PayloadLiteral>(payloadLiteral: PL) {
  return [
    payloadLiteral === "Uint8Array"
      ? { name: "payload", binary: "bytes" }
      : { name: "payload", binary: "object", layout: getPayloadLayout(payloadLiteral) },
  ] as PayloadLiteralToPayloadItemLayout<PL>;
}

export function serialize<PL extends PayloadLiteral>(vaa: VAA<PL>): Uint8Array {
  const layout = [
    ...baseLayout,
    ...payloadLiteralToPayloadItemLayout(vaa.payloadLiteral),
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

type AtLeast1<T> = readonly [T, ...T[]];
type AtLeast2<T> = readonly [T, T, ...T[]];

//string assumed to be in hex format
type Byteish = Uint8Array | string;

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
type PayloadGroupsToLayoutLiteralsRecursive<PGA extends readonly PayloadGroup[]> =
  PGA extends readonly [infer PG extends PayloadGroup, ...infer T extends readonly PayloadGroup[]]
    ? PayloadGroupToLayoutLiterals<PG> | PayloadGroupsToLayoutLiteralsRecursive<T>
    : never;
type PayloadGroupsToLayoutLiterals<PGA extends readonly PayloadGroup[]> =
  PayloadGroupsToLayoutLiteralsRecursive<PGA> extends infer Value extends LayoutLiteral
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
>(payloadLiterals: LLD, allowAmbiguous?: B): PayloadDiscriminator<LLDtoLLs<LLD>, B> {
  const literals = (() => {
    if (Array.isArray(payloadLiterals[0]))
      return (payloadLiterals as AtLeast2<PayloadGroup>).flatMap(([protocol, payloadNames]) =>
        payloadNames.map((name) => composeLiteral(protocol, name)),
      );

    if (typeof payloadLiterals[1] === "string") return payloadLiterals as AtLeast2<LayoutLiteral>;

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

type ExtractLiteral<T> = T extends PayloadDiscriminator<infer LL> ? LL : T;

export function deserialize<T extends PayloadLiteral | PayloadDiscriminator>(
  payloadDet: T,
  data: Byteish,
): DistributiveVAA<ExtractLiteral<T>> {
  if (typeof data === "string") data = encoding.hex.decode(data);

  const [header, envelopeOffset] = deserializeLayout(headerLayout, data, 0, false);

  //ensure that guardian signature indicies are unique and in ascending order - see:
  //https://github.com/wormhole-foundation/wormhole/blob/8e0cf4c31f39b5ba06b0f6cdb6e690d3adf3d6a3/ethereum/contracts/Messages.sol#L121
  for (let i = 1; i < header.signatures.length; ++i)
    if (header.signatures[i]!.guardianIndex <= header.signatures[i - 1]!.guardianIndex)
      throw new Error("Guardian signatures must be in ascending order of guardian set index");

  const [envelope, payloadOffset] = deserializeLayout(envelopeLayout, data, envelopeOffset, false);

  const [payloadLiteral, payload] =
    typeof payloadDet === "string"
      ? [
          payloadDet as PayloadLiteral,
          deserializePayload(payloadDet as PayloadLiteral, data, payloadOffset),
        ]
      : deserializePayload(payloadDet as PayloadDiscriminator, data, payloadOffset);
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

export function deserializePayload<T extends PayloadLiteral | PayloadDiscriminator>(
  payloadDet: T,
  data: Byteish,
  offset = 0,
): DeserializePayloadReturn<T> {
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
      throw new Error(`Encoded data does not match any of the given payload types - ${data}`);

    return [candidate, deserializeLayout(getPayloadLayout(candidate), data, offset)];
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
        acc.push([literal, deserializePayload(literal!, data)] as DeserializedPair);
      } catch {}
      return acc;
    }, [] as DeserializedPair[]);
  };
})();
