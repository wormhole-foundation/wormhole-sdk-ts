import {
  Layout,
  UintLayoutItem,
  LengthPrefixedBytesLayoutItem,
} from "@wormhole-foundation/sdk-base";
import { chainItem, amountItem } from "../layout-items";
import { RegisterPayloadTypes, NamedPayloads, registerPayloadTypes } from "../vaa";

const bamAddressItem = {
  binary: "bytes",
  lengthSize: 2,
} as const satisfies LengthPrefixedBytesLayoutItem;

const customOrEmpty = (custom: any) => (custom ? { custom } : {});

export const messageLayout = <
  T extends number,
  C extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
>(
  type: T,
  customContents?: C,
) =>
  [
    { name: "magicByte", binary: "uint", size: 1, custom: 0xbb, omit: true },
    { name: "version", binary: "uint", size: 1, custom: 0, omit: true },
    { name: "type", binary: "uint", size: 1, custom: type, omit: true },
    { name: "index", binary: "uint", size: 8 },
    { name: "targetChain", ...chainItem() },
    { name: "targetAddress", ...bamAddressItem },
    { name: "senderAddress", ...bamAddressItem },
    { name: "contents", binary: "bytes", lengthSize: 2, ...customOrEmpty(customContents) },
  ] as const satisfies Layout;

export const tokenMessageLayout = <
  C extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
  B extends Pick<UintLayoutItem, "custom">,
  A extends Pick<UintLayoutItem, "custom">,
>(custom?: {
  contents?: C;
  bridge?: B;
  assetIdentifier?: A;
}) =>
  [
    ...messageLayout(1, custom?.contents),
    { name: "bridge", binary: "uint", size: 1, ...customOrEmpty(custom?.bridge) },
    { name: "assetIdentifier", binary: "uint", size: 2, ...customOrEmpty(custom?.assetIdentifier) },
    { name: "amount", ...amountItem },
  ] as const satisfies Layout;

export const extendedMessageLayout = <
  C extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
  R extends Pick<LengthPrefixedBytesLayoutItem, "custom">,
>(custom?: {
  contents?: C;
  relaySignal?: R;
}) =>
  [
    ...messageLayout(2, custom?.contents),
    { name: "relaySignal", binary: "bytes", lengthSize: 2, ...customOrEmpty(custom?.relaySignal) },
  ] as const satisfies Layout;

export const namedPayloads = [
  ["Message", messageLayout(0)],
  ["TokenMessage", tokenMessageLayout()],
  ["ExtendedMessage", extendedMessageLayout()],
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"BAM", typeof namedPayloads> {}
  }
}

registerPayloadTypes("BAM", namedPayloads);
