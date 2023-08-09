import {
  Layout,
  UintLayoutItem,
  CustomConversion,
  FixedSizeBytesLayoutItem,
  range,
  ToMapping,
} from "@wormhole-foundation/sdk-base";
import { chainItem, universalAddressItem, amountItem } from "../layout-items";
import { registerPayloadType } from "../vaa";

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

const payloadIdItem = <ID extends number>(id: ID) =>
  ({
    name: "payloadId",
    binary: "uint",
    size: 1,
    custom: id,
    omit: true,
  } as const satisfies UintLayoutItem);

const transferCommonLayout = [
  {
    name: "token",
    binary: "object",
    layout: [
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
    [
      payloadIdItem(3),
      ...transferCommonLayout,
      { name: "from", ...universalAddressItem },
      { name: "payload", binary: "bytes" },
    ],
  ],
] as const satisfies readonly (readonly [string, Layout])[];

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToDescriptionMapping
      extends ToMapping<typeof tokenBridgePayloads> {}
  }
}

tokenBridgePayloads.forEach(([payloadLiteral, layout]) =>
  registerPayloadType(payloadLiteral, layout)
);
