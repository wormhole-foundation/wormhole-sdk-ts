import {
  Layout,
  ShallowMapping,
  UintLayoutItem,
  ObjectLayoutItem,
} from "@wormhole-foundation/sdk-base";
import {
  chainItem,
  universalAddressItem,
  sequenceItem,
  amountItem,
} from "../layout-items";
import { registerPayloadType } from "../vaa";

const encodedExecutionInfoItem = {
  binary: "object",
  layout: [
    { name: "size", binary: "uint", size: 4, custom: 3*32, omit: true },
    { name: "waste", binary: "uint", size: 31, custom: 0n, omit: true },
    { name: "version", binary: "uint", size: 1, custom: 0, omit: true },
    { name: "gasLimit", ...amountItem },
    { name: "targetChainRefundPerGasUnused", ...amountItem },
  ]
} as const satisfies Omit<ObjectLayoutItem, "name">;

const payloadIdItem = <N extends number>(id: N) =>
  ({
    name: "payloadId",
    binary: "uint",
    size: 1,
    custom: id,
    omit: true,
  } as const satisfies UintLayoutItem);

const addressChainItem = {
  binary: "object",
  layout: [
    { name: "chain", ...chainItem() },
    { name: "address", ...universalAddressItem },
  ],
} as const satisfies Omit<ObjectLayoutItem, "name">;

const vaaKeyLayout = [
  { name: "version", binary: "uint", size: 1, custom: { to: "Key", from: 1 } },
  { name: "chain", ...chainItem() },
  { name: "emitterAddress", ...universalAddressItem },
  { name: "sequence", ...sequenceItem },
] as const satisfies Layout;

const relayerPayloads = [
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
      { name: "vaaKeys", binary: "array", lengthSize: 1, layout: vaaKeyLayout },
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
      { name: "version", binary: "uint", size: 1, custom: 1, omit: true },
      { name: "receiverValue", ...amountItem },
      { name: "newExecutionInfo", ...encodedExecutionInfoItem },
      { name: "redeliveryHash", binary: "bytes", size: 32 },
    ],
  ],
] as const satisfies readonly (readonly [string, Layout])[];

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToDescriptionMapping
      extends ShallowMapping<typeof relayerPayloads> {}
  }
}

relayerPayloads.forEach(([payloadLiteral, layout]) =>
  registerPayloadType(payloadLiteral, layout)
);
