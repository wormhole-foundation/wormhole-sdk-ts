import { ShallowMapping } from "@wormhole-foundation/sdk-base";
import {
  payloadIdItem,
  universalAddressItem,
  amountItem,
  chainItem,
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
  { name: "destinationDomain", binary: "uint", size: 8 },
  { name: "nonce", binary: "uint", size: 8 },
  { name: "caller", ...universalAddressItem },
  { name: "mintRecipient", ...universalAddressItem },
  // TODO:
  { name: "idk", binary: "uint", size: 2 },
  { name: "otherpayloadid", binary: "uint", size: 1, exclude: true },
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
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
