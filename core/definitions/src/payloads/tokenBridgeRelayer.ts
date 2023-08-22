import { ToMapping } from "@wormhole-foundation/sdk-base";
import { payloadIdItem, universalAddressItem, amountItem } from "../layout-items";
import { registerPayloadType } from "../vaa";
import { transferWithPayloadLayout } from "./tokenBridge";

const transferWithRelayLayout = [
  payloadIdItem(1),
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
] as const;

export const tokenBridgeRelayerPayloads = [
  [
    "TokenBridgeRelayerTransferLayout",
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
      extends ToMapping<typeof tokenBridgeRelayerPayloads> {}
  }
}

tokenBridgeRelayerPayloads.forEach(([payloadLiteral, layout]) =>
  registerPayloadType(payloadLiteral, layout)
);