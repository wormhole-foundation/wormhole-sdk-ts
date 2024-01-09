import { Layout, LengthPrefixedBytesLayoutItem } from "@wormhole-foundation/sdk-base";
import {
  payloadIdItem,
  universalAddressItem,
  amountItem,
  circleDomainItem,
  circleNonceItem,
} from "../layout-items";
import { RegisterPayloadTypes, NamedPayloads, registerPayloadTypes } from "../vaa";

//from here: https://github.com/wormhole-foundation/wormhole-circle-integration/blob/105ad59bad687416527003e0241dee4020889341/evm/src/circle_integration/CircleIntegrationMessages.sol#L25
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
  { name: "sourceDomain", ...circleDomainItem },
  { name: "targetDomain", ...circleDomainItem },
  { name: "nonce", ...circleNonceItem },
  { name: "caller", ...universalAddressItem },
  { name: "mintRecipient", ...universalAddressItem },
] as const;

//a future optimization would be to calculate the layout size from the layout itself
//  thought that does require implementing arithmetic on number literals, which is its very
//  own can of worms
export const depositWithSizedLayoutPayload = <S extends number, L extends Layout>(
  byteSize: S,
  layout: L,
) =>
  [
    ...depositWithPayloadBase,
    { name: "payloadSize", binary: "uint", size: 2, custom: byteSize, omit: true },
    { name: "payload", binary: "object", layout },
  ] as const;

export const depositWithBytesPayload = <C extends Pick<LengthPrefixedBytesLayoutItem, "custom">>(
  customPayload: C,
) =>
  [
    ...depositWithPayloadBase,
    { name: "payload", binary: "bytes", lengthSize: 2, ...customPayload },
  ] as const;

//from here:
//  https://github.com/wormhole-foundation/example-circle-relayer/blob/189becd8d3935decb17383bd2e61b4909cbddc89/evm/src/circle-relayer/CircleRelayerMessages.sol#L16
export const connectPayload = [
  payloadIdItem(1),
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
] as const;

export const namedPayloads = [
  ["DepositWithPayload", depositWithBytesPayload({})],
  ["TransferWithRelay", depositWithSizedLayoutPayload(1 + 3 * 32, connectPayload)],
] as const satisfies NamedPayloads;

// factory registration:
declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"AutomaticCircleBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("AutomaticCircleBridge", namedPayloads);
