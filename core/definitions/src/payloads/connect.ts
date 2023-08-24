import { ShallowMapping } from "@wormhole-foundation/sdk-base";
import { payloadIdItem, universalAddressItem, amountItem } from "../layout-items";
import { registerPayloadType } from "../vaa";
import { transferWithPayloadLayout } from "./tokenBridge";

const transferWithRelayLayout = [
  payloadIdItem(1),
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
] as const;

export const connectPayloads = [
  [
    "ConnectTransferLayout",
    transferWithPayloadLayout({
      binary: "object",
      layout: transferWithRelayLayout,
    })
  ],
] as const;

// factory registration:

declare global {
  namespace Wormhole {
    interface PayloadLiteralToDescriptionMapping
      extends ShallowMapping<typeof connectPayloads> {}
  }
}

connectPayloads.forEach(([payloadLiteral, layout]) =>
  registerPayloadType(payloadLiteral, layout)
);