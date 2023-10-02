import {
  Layout,
  LengthPrefixedBytesLayoutItem,
  ShallowMapping,
} from "@wormhole-foundation/sdk-base";
import { chainItemBase, sequenceItem } from "../layout-items";
import { registerPayloadType } from "../vaa";

const bamCommonLayout: Layout = [
  { name: "magicByte", binary: "uint", size: 1 },
  { name: "version", binary: "uint", size: 1 },
  { name: "type", binary: "uint", size: 1 },
];

const bamLayout0: Layout = [
  { name: "index", ...sequenceItem },
  { name: "targetChain", ...chainItemBase },
  {
    name: "targetAddress",
    binary: "bytes",
    lengthSize: 2,
  } as LengthPrefixedBytesLayoutItem,
  {
    name: "senderAddress",
    binary: "bytes",
    lengthSize: 2,
  } as LengthPrefixedBytesLayoutItem,
  {
    name: "contents",
    binary: "bytes",
    lengthSize: 2,
  } as LengthPrefixedBytesLayoutItem,
];

export const bamPayloads = [
  ["BAMessage", [...bamCommonLayout, ...bamLayout0]],
] as const satisfies readonly (readonly [string, Layout])[];

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToDescriptionMapping
      extends ShallowMapping<typeof bamPayloads> {}
  }
}

bamPayloads.forEach(([payloadLiteral, layout]) =>
  registerPayloadType(payloadLiteral, layout)
);
