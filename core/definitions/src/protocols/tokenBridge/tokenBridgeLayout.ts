import {
  Layout,
  LayoutItem,
  CustomConversion,
  CustomizableBytes,
  customizableBytes,
  range,
} from "@wormhole-foundation/sdk-base";
import { payloadIdItem, chainItem, universalAddressItem, amountItem } from "../../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../../vaa";

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
} as const satisfies LayoutItem;

const transferCommonLayout = [
  {
    name: "token",
    binary: "bytes",
    layout: [
      { name: "amount", ...amountItem },
      { name: "address", ...universalAddressItem },
      { name: "chain", ...chainItem() },
    ],
  },
  {
    name: "to",
    binary: "bytes",
    layout: [
      { name: "address", ...universalAddressItem },
      { name: "chain", ...chainItem() },
    ],
  },
] as const satisfies Layout;

export const transferWithPayloadLayout = <const P extends CustomizableBytes = undefined>(
  customPayload?: P,
) =>
  [
    payloadIdItem(3),
    ...transferCommonLayout,
    { name: "from", ...universalAddressItem },
    customizableBytes({ name: "payload" }, customPayload),
  ] as const;

export const tokenBridgeNamedPayloads = [
  [
    "AttestMeta",
    [
      payloadIdItem(2),
      {
        name: "token",
        binary: "bytes",
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
  ["TransferWithPayload", transferWithPayloadLayout()],
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"TokenBridge", typeof tokenBridgeNamedPayloads> {}
  }
}

registerPayloadTypes("TokenBridge", tokenBridgeNamedPayloads);
