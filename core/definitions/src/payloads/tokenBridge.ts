import {
  Layout,
  LayoutItem,
  CustomConversion,
  FixedSizeBytesLayoutItem,
  range,
} from "@wormhole-foundation/sdk-base";
import { payloadIdItem, chainItem, universalAddressItem, amountItem } from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

const fixedLengthStringItem = {
  binary: "bytes",
  size: 32,
  custom: {
    to: (val: Uint8Array) =>
      range(val.byteLength)
        .map((i) => String.fromCharCode(val[i]!))
        .join(""),
    from: (str: string) => new Uint8Array(str.split("").map((c) => c.charCodeAt(0))),
  } satisfies CustomConversion<Uint8Array, string>,
} as const satisfies FixedSizeBytesLayoutItem;

export const transferWithPayloadLayout = <P extends LayoutItem>(customPayload: P) =>
  [
    payloadIdItem(3),
    ...transferCommonLayout,
    { name: "from", ...universalAddressItem },
    { name: "payload", ...customPayload },
  ] as const;

const transferCommonLayout = [
  {
    name: "token",
    binary: "object",
    layout: [
      { name: "amount", ...amountItem },
      { name: "address", ...universalAddressItem },
      { name: "chain", ...chainItem() },
    ],
  },
  {
    name: "to",
    binary: "object",
    layout: [
      { name: "address", ...universalAddressItem },
      { name: "chain", ...chainItem() },
    ],
  },
] as const satisfies Layout;

export const namedPayloads = [
  [
    "AttestMeta",
    [
      payloadIdItem(2),
      {
        name: "token",
        binary: "object",
        layout: [
          { name: "address", ...universalAddressItem },
          { name: "chain", ...chainItem() },
        ],
      },
      { name: "decimals", binary: "uint", size: 1 },
      { name: "symbol", ...fixedLengthStringItem },
      { name: "name", ...fixedLengthStringItem },
    ],
  ],
  ["Transfer", [payloadIdItem(1), ...transferCommonLayout, { name: "fee", ...amountItem }]],
  ["TransferWithPayload", transferWithPayloadLayout({ binary: "bytes" })],
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"TokenBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("TokenBridge", namedPayloads);
