import { Layout, LayoutToType } from "@wormhole-foundation/sdk-base";

import {
  chainItem,
  universalAddressItem,
  signatureItem,
  sequenceItem,
  guardianSetItem,
} from "../layout-items";

import {
  LayoutLiteral,
  PayloadLiteral,
  LayoutOf,
  ProtocolName,
  ComposeLiteral,
} from "./registration";

export type LayoutLiteralToPayload<LL extends LayoutLiteral> = LayoutToType<LayoutOf<LL>>;

export type Payload<PL extends PayloadLiteral> = PL extends LayoutLiteral
  ? LayoutLiteralToPayload<PL>
  : Uint8Array;

export type DecomposeLiteral<PL extends PayloadLiteral> =
  PL extends `${infer Protocol}:${infer LayoutName}` ? [Protocol, LayoutName] : [null, PL];

export function decomposeLiteral<PL extends PayloadLiteral>(payloadLiteral: PL) {
  const index = payloadLiteral.indexOf(":");
  return (
    index !== -1
      ? [payloadLiteral.slice(0, index), payloadLiteral.slice(index + 1)]
      : [null, payloadLiteral]
  ) as DecomposeLiteral<PL>;
}

const guardianSignatureLayout = [
  { name: "guardianIndex", binary: "uint", size: 1 },
  { name: "signature", ...signatureItem },
] as const satisfies Layout;

export const headerLayout = [
  { name: "version", binary: "uint", size: 1, custom: 1, omit: true },
  { name: "guardianSet", ...guardianSetItem },
  { name: "signatures", binary: "array", lengthSize: 1, layout: guardianSignatureLayout },
] as const satisfies Layout;

//envelope + payload are getting hashed and signed
export const envelopeLayout = [
  { name: "timestamp", binary: "uint", size: 4 },
  { name: "nonce", binary: "uint", size: 4 },
  { name: "emitterChain", ...chainItem() },
  { name: "emitterAddress", ...universalAddressItem },
  { name: "sequence", ...sequenceItem },
  { name: "consistencyLevel", binary: "uint", size: 1 },
] as const satisfies Layout;

export const baseLayout = [...headerLayout, ...envelopeLayout] as const;
type VAABase = LayoutToType<typeof baseLayout>;

export interface VAA<PL extends PayloadLiteral = PayloadLiteral> extends VAABase {
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
export type DistributiveVAA<PL extends PayloadLiteral> = PL extends PayloadLiteral
  ? VAA<PL>
  : never;

export type ProtocolVAA<PN extends ProtocolName, PayloadName extends string> = ComposeLiteral<
  PN,
  PayloadName,
  PayloadLiteral
> extends infer PL extends PayloadLiteral
  ? DistributiveVAA<PL>
  : never;

export type DistributivePayload<PL extends PayloadLiteral> = PL extends PayloadLiteral
  ? Payload<PL>
  : never;

export type ProtocolPayload<PN extends ProtocolName, PayloadName extends string> = ComposeLiteral<
  PN,
  PayloadName,
  PayloadLiteral
> extends infer PL extends PayloadLiteral
  ? DistributivePayload<PL>
  : never;
