import {
  Layout,
  LengthPrefixedBytesLayoutItem,
  CircleChainName,
  circleChainId,
  toCircleChainName
} from "@wormhole-foundation/sdk-base";
import { payloadIdItem, universalAddressItem, amountItem } from "../layout-items";
import { RegisterPayloadTypes, NamedPayloads, registerPayloadTypes } from "../vaa";

const domainItem = {
  binary: "uint",
  size: 4,
  custom: {
    to: (id: number) => toCircleChainName(id),
    from: (name: CircleChainName) => circleChainId(name),
  } as const,
} as const;

const depositWithPayloadBase = [
  payloadIdItem(1),
  {
    name: "token",
    binary: "object",
    layout: [
      { name: "address", ...universalAddressItem },
      { name: "amount", ...amountItem },
    ],
  },
  { name: "sourceDomain", ...domainItem },
  { name: "targetDomain", ...domainItem },
  { name: "nonce", binary: "uint", size: 8 },
  { name: "caller", ...universalAddressItem },
  { name: "mintRecipient", ...universalAddressItem },
] as const;

//a future optimization would be to calculate the layout size from the layout itself
//  thought that does require implementing arithmetic on number literals, which is its very
//  own can of worms
export const depositWithSizedLayoutPayload = <S extends number, L extends Layout>(
  byteSize: S,
  layout: L,
) => [
  ...depositWithPayloadBase,
  { name: "payloadSize", binary: "uint", size: 2, custom: byteSize, omit: true },
  { name: "payload", binary: "object", layout }
] as const;

export const depositWithBytesPayload = <C extends Pick<LengthPrefixedBytesLayoutItem, "custom">>(
  customPayload: C
) => [
  ...depositWithPayloadBase,
  { name: "payload", binary: "bytes", lengthSize: 2, ...customPayload}
] as const;

export const namedPayloads = [
  ["DepositWithPayload", depositWithBytesPayload({})],
  ["TransferRelay",
    depositWithSizedLayoutPayload(
      1+3*32,
      [
        payloadIdItem(1),
        { name: "targetRelayerFee", ...amountItem },
        { name: "toNativeTokenAmount", ...amountItem },
        { name: "targetRecipient", ...universalAddressItem },
      ] as const
    )
  ]
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"CCTP", typeof namedPayloads> {}
  }
}

registerPayloadTypes("CCTP", namedPayloads);
