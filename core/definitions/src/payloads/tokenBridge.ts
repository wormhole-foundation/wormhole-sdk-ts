import {
  Layout,
  LayoutItem,
  CustomConversion,
  FixedSizeBytesLayoutItem,
  range,
  ShallowMapping,
} from "@wormhole-foundation/sdk-base";
import { payloadIdItem, chainItem, universalAddressItem, amountItem } from "../layout-items";
import { NamedPayloads, payloadDiscriminator, registerPayloadType } from "../vaa";

const fixedLengthStringItem = {
  binary: "bytes",
  size: 32,
  custom: {
    to: (val: Uint8Array) =>
      range(val.byteLength)
        .map((i) => String.fromCharCode(val[i]))
        .join(""),
    from: (str: string) =>
      new Uint8Array(str.split("").map((c) => c.charCodeAt(0))),
  } satisfies CustomConversion<Uint8Array, string>,
} as const satisfies Omit<FixedSizeBytesLayoutItem, "name">;

export const transferWithPayloadLayout = <const P extends Omit<LayoutItem, "name">>(
  customPayload: P
) => ([
  payloadIdItem(3),
  ...transferCommonLayout,
  { name: "from", ...universalAddressItem },
  { name: "payload", ...customPayload },
] as const);

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

export const tokenBridgePayloads = [
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
  [
    "Transfer",
    [payloadIdItem(1), ...transferCommonLayout, { name: "fee", ...amountItem }],
  ],
  [
    "TransferWithPayload",
    transferWithPayloadLayout({ binary: "bytes" }),
  ],
] as const satisfies NamedPayloads;

// export const tokenBridgePayloadDiscriminator = payloadDiscriminator(tokenBridgePayloads);

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToDescriptionMapping
      extends ShallowMapping<typeof tokenBridgePayloads> {}
  }
}

tokenBridgePayloads.forEach(([payloadLiteral, layout]) =>
  registerPayloadType(payloadLiteral, layout)
);
