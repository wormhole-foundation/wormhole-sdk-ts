import { ShallowMapping } from "@wormhole-foundation/sdk-base";
import {
  payloadIdItem,
  universalAddressItem,
  amountItem,
} from "../layout-items";
import { registerPayloadType } from "../vaa";

const circleTransferRelay = [
  payloadIdItem(1),
  {
    name: "token",
    binary: "object",
    layout: [
      { name: "address", ...universalAddressItem },
      { name: "amount", ...amountItem },
    ],
  },
  { name: "sourceDomain", binary: "uint", size: 4 },
  { name: "targetDomain", binary: "uint", size: 4 },
  { name: "nonce", binary: "uint", size: 8 },
  { name: "caller", ...universalAddressItem },
  { name: "mintRecipient", ...universalAddressItem },
  { name: "payloadSize", binary: "uint", size: 2 },
  {
    name: "relayerPayload",
    binary: "object",
    layout: [
      payloadIdItem(1),
      { name: "targetRelayerFee", ...amountItem },
      { name: "toNativeTokenAmount", ...amountItem },
      { name: "targetRecipient", ...universalAddressItem },
    ],
  },
] as const;

export const connectPayloads = [
  ["CircleTransferRelay", circleTransferRelay],
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
