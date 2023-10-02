import { Layout, UintLayoutItem, LengthPrefixedBytesLayoutItem, ShallowMapping } from "@wormhole-foundation/sdk-base";
import { chainItem, amountItem } from "../layout-items";
import { registerPayloadType } from "../vaa";

const bamAddressItem = {
  binary: "bytes",
  lengthSize: 2
} as const satisfies Omit<LengthPrefixedBytesLayoutItem, "name">;

const customOrEmpty = (custom: any) => custom ? { custom } : {};

const messageLayout = <
  const T extends number,
  const C extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
>(type: T, customContents?: C) => [
  { name: "magicByte", binary: "uint", size: 1, custom: 0xbb, omit: true },
  { name: "version", binary: "uint", size: 1, custom: 0, omit: true },
  { name: "type", binary: "uint", size: 1, custom: type, omit: true },
  { name: "index", binary: "uint", size: 8 },
  { name: "targetChain", ...chainItem() },
  { name: "targetAddress", ...bamAddressItem },
  { name: "senderAddress", ...bamAddressItem },
  { name: "contents", binary: "bytes", lengthSize: 2, ...customOrEmpty(customContents) },
] as const satisfies Layout;

const tokenMessageLayout = <
  const C extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
  const B extends Pick<UintLayoutItem, "custom">,
  const A extends Pick<UintLayoutItem, "custom">,
>(
  custom?: { contents?: C, bridge?: B, assetIdentifier?: A },
) => [
  ...messageLayout(1, custom?.contents),
  { name: "bridge", binary: "uint", size: 1, ...customOrEmpty(custom?.bridge) },
  { name: "assetIdentifier", binary: "uint", size: 2, ...customOrEmpty(custom?.assetIdentifier) },
  { name: "amount", ...amountItem },
] as const satisfies Layout;

const extendedMessageLayout = <
  const C extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
  const R extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
>(
  custom?: { contents?: C, relaySignal?: R },
) => [
  ...messageLayout(2, custom?.contents),
  { name: "relaySignal", binary: "bytes", lengthSize: 2, ...customOrEmpty(custom?.relaySignal) },
] as const satisfies Layout;

export const bamPayloads = [
  [ "BamMessage", messageLayout(0) ],
  [ "BamTokenMessage", tokenMessageLayout() ],
  [ "BamExtendedMessage", extendedMessageLayout() ],
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
