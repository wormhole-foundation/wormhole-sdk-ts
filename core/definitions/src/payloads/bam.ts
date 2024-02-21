import {
  Layout,
  UintLayoutItem,
  CustomizableBytes,
  customizableBytes,
} from "@wormhole-foundation/sdk-base";
import { chainItem, amountItem } from "../layout-items";
import { RegisterPayloadTypes, NamedPayloads, registerPayloadTypes } from "../vaa";

const bamAddressItem = {
  binary: "bytes",
  lengthSize: 2,
} as const;

const customOrEmpty = (custom: any) => (custom ? { custom } : {});

export const messageLayout = <
  T extends number,
  const C extends CustomizableBytes = undefined,
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
    customizableBytes({ name: "contents", lengthSize: 2 }, customContents),
  ] as const satisfies Layout;

export const tokenMessageLayout = <
  B extends Pick<UintLayoutItem, "custom">,
  A extends Pick<UintLayoutItem, "custom">,
  const C extends CustomizableBytes = undefined,
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
  const C extends CustomizableBytes = undefined,
  const R extends CustomizableBytes = undefined,
>(custom?: {
  contents?: C;
  relaySignal?: R;
}) =>
  [
    ...messageLayout(2, custom?.contents),
    customizableBytes({ name: "relaySignal", lengthSize: 2}, custom?.relaySignal),
  ] as const satisfies Layout;

export const namedPayloads = [
  ["Message", messageLayout(0)],
  ["TokenMessage", tokenMessageLayout()],
  ["ExtendedMessage", extendedMessageLayout()],
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"BAM", typeof namedPayloads> {}
  }
}

registerPayloadTypes("BAM", namedPayloads);
