import { LayoutItem, UintLayoutItem } from "@wormhole-foundation/sdk-base";
import {
  amountItem,
  chainItem,
  circleDomainItem,
  circleNonceItem,
  payloadIdItem,
  sequenceItem,
  universalAddressItem,
} from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

const versionByte = <N extends number>(id: N) =>
  ({
    name: "version",
    binary: "uint",
    size: 1,
    custom: id,
    omit: true,
  } as const satisfies UintLayoutItem & { readonly name: string });

const encodedExecutionInfoItem = {
  binary: "object",
  layout: [
    { name: "size", binary: "uint", size: 4, custom: 3*32, omit: true },
    { name: "waste", binary: "uint", size: 31, custom: 0n, omit: true },
    versionByte(0),
    { name: "gasLimit", ...amountItem },
    { name: "targetChainRefundPerGasUnused", ...amountItem },
  ]
} as const satisfies LayoutItem;

const addressChainItem = {
  binary: "object",
  layout: [
    { name: "chain", ...chainItem() },
    { name: "address", ...universalAddressItem },
  ],
} as const satisfies LayoutItem;

const vaaKeyLayout = [
  { name: "chain", ...chainItem() },
  { name: "emitterAddress", ...universalAddressItem },
  { name: "sequence", ...sequenceItem },
] as const;

const cctpKeyLayout = [
  { name: "size", binary: "uint", size: 4, custom: 12, omit: true },
  { name: "domain", ...circleDomainItem },
  { name: "nonce", ...circleNonceItem },
] as const;

const messageKeySwitchLayout = {
  binary: "switch",
  idSize: 1,
  idTag: "keyType",
  idLayoutPairs: [
    [[1, "VAA"], vaaKeyLayout],
    [[2, "CCTP"], cctpKeyLayout]
  ]
} as const satisfies LayoutItem;

const namedPayloads = [
  [
    "DeliveryInstruction",
    [
      payloadIdItem(1),
      { name: "target", ...addressChainItem },
      { name: "payload", binary: "bytes", lengthSize: 4 },
      { name: "requestedReceiverValue", ...amountItem },
      { name: "extraReceiverValue", ...amountItem },
      { name: "executionInfo", ...encodedExecutionInfoItem },
      { name: "refund", ...addressChainItem },
      { name: "refundDeliveryProvider", ...universalAddressItem },
      { name: "sourceDeliveryProvider", ...universalAddressItem },
      { name: "senderAddress", ...universalAddressItem },
      { name: "messageKeys", binary: "array", lengthSize: 1, arrayItem: messageKeySwitchLayout },
    ],
  ],
  [
    "RedeliveryInstruction",
    [
      payloadIdItem(2),
      { name: "deliveryVaaKey", binary: "object", layout: vaaKeyLayout },
      { name: "targetChain", ...chainItem() },
      { name: "newRequestedReceiverValue", ...amountItem },
      { name: "newEncodedExecutionInfo", ...encodedExecutionInfoItem },
      { name: "newSourceDeliveryProvider", ...universalAddressItem },
      { name: "newSenderAddress", ...universalAddressItem },
    ],
  ],
  [
    "DeliveryOverride",
    [
      versionByte(1),
      { name: "receiverValue", ...amountItem },
      { name: "newExecutionInfo", ...encodedExecutionInfoItem },
      { name: "redeliveryHash", binary: "bytes", size: 32 },
    ],
  ],
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"Relayer", typeof namedPayloads> {}
  }
}

registerPayloadTypes("Relayer", namedPayloads);