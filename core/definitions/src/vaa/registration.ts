import { Layout } from "@wormhole-foundation/sdk-base";

//LayoutLiteralToLayoutMapping is the compile-time analog/complement to the runtime
//  payload factory. It uses TypeScript's interface merging mechanic to "dynamically" extend known
//  payload types that are declared in different protocols. This allows us to have full type safety
//  when constructing payloads via the factory without having to ever declare the mapping of all
//  payloads and their respective layouts in a single place (which, besides being a terrible code
//  smell, would also prevent users of the SDK to register their own payload types!)
declare global {
  namespace WormholeNamespace {
    //effective type: Record<string, Layout>
    interface PayloadLiteralToLayoutMapping {}
  }
}

export type LayoutLiteral = keyof WormholeNamespace.PayloadLiteralToLayoutMapping & string;

export type PayloadLiteral = LayoutLiteral | "Uint8Array";

export type LayoutOf<LL extends LayoutLiteral> = LL extends infer V extends LayoutLiteral
  ? WormholeNamespace.PayloadLiteralToLayoutMapping[V]
  : never;

//we aren't enforcing that Protocol is actually a protocol as to keep things user-extensible
export type ProtocolName = string | null;

type ToLiteralFormat<PN extends ProtocolName, PayloadName extends string> = PN extends null
  ? PayloadName
  : `${PN}:${PayloadName}`;

export type ComposeLiteral<
  ProtocolN extends ProtocolName,
  PayloadN extends string,
  Literal,
> = ToLiteralFormat<ProtocolN, PayloadN> extends infer L extends Literal ? L : never;

export const composeLiteral = <ProtocolN extends ProtocolName, PayloadN extends string>(
  protocol: ProtocolN,
  payloadName: PayloadN,
) =>
  (protocol ? `${protocol}:${payloadName}` : payloadName) as ComposeLiteral<
    ProtocolN,
    PayloadN,
    PayloadLiteral
  >;

export const payloadFactory = new Map<LayoutLiteral, Layout>();

export function registerPayloadType(protocol: ProtocolName, name: string, layout: Layout) {
  const payloadLiteral = composeLiteral(protocol, name);
  if (payloadFactory.has(payloadLiteral))
    throw new Error(`Payload type ${payloadLiteral} already registered`);

  payloadFactory.set(payloadLiteral, layout);
}

type AtLeast1<T> = readonly [T, ...T[]];

export type NamedPayloads = AtLeast1<readonly [string, Layout]>;

export type RegisterPayloadTypes<ProtocolN extends ProtocolName, NP extends NamedPayloads> = {
  readonly [E in NP[number] as ToLiteralFormat<ProtocolN, E[0]>]: E[1];
};

export function registerPayloadTypes(protocol: ProtocolName, payloads: NamedPayloads) {
  for (const [name, layout] of payloads) registerPayloadType(protocol, name, layout);
}
