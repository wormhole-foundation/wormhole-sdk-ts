import { LayoutItem } from "@wormhole-foundation/sdk-base";
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

const encodedExecutionInfoItem = {
  binary: "object",
  layout: [
    { name: "size", binary: "uint", size: 4, custom: 3 * 32, omit: true },
    { name: "waste", binary: "uint", size: 31, custom: 0n, omit: true },
    { name: "version", binary: "uint", size: 1, custom: 0, omit: true },
    { name: "gasLimit", ...amountItem },
    { name: "targetChainRefundPerGasUnused", ...amountItem },
  ],
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
  layouts: [
    [[1, "VAA"], vaaKeyLayout],
    [[2, "CCTP"], cctpKeyLayout],
  ],
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
      { name: "messageKeys", binary: "array", lengthSize: 1, layout: messageKeySwitchLayout },
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
] as const satisfies NamedPayloads;

// factory registration:

declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"Relayer", typeof namedPayloads> {}
  }
}

registerPayloadTypes("Relayer", namedPayloads);
