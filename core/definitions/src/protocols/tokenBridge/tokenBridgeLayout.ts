import type {
  Layout,
  CustomConversion,
  CustomizableBytes,
} from "@wormhole-foundation/sdk-base";
import { customizableBytes, range } from "@wormhole-foundation/sdk-base";
import {
  amountItem,
  chainItem,
  payloadIdItem,
  universalAddressItem,
} from "./../../layout-items/index.js";
import type { NamedPayloads, RegisterPayloadTypes } from "./../../vaa/index.js";
import { registerPayloadTypes } from "./../../vaa/index.js";

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
} as const satisfies Layout;

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

declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"TokenBridge", typeof tokenBridgeNamedPayloads> {}
  }
}

registerPayloadTypes("TokenBridge", tokenBridgeNamedPayloads);
