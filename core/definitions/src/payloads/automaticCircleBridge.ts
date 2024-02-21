import { Layout, CustomizableBytes, customizableBytes } from "@wormhole-foundation/sdk-base";
import {
  payloadIdItem,
  universalAddressItem,
  amountItem,
  circleDomainItem,
  circleNonceItem,
} from "../layout-items";
import { RegisterPayloadTypes, NamedPayloads, registerPayloadTypes } from "../vaa";

//from here: https://github.com/wormhole-foundation/wormhole-circle-integration/blob/105ad59bad687416527003e0241dee4020889341/evm/src/circle_integration/CircleIntegrationMessages.sol#L25
export const depositWithPayloadLayout = <const P extends CustomizableBytes = undefined>(
  customPayload?: P,
) => [
  payloadIdItem(1),
  {
    name: "token",
    binary: "bytes",
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
  customizableBytes({ name: "payload", lengthSize: 2}, customPayload),
] as const satisfies Layout;

//from here:
//  https://github.com/wormhole-foundation/example-circle-relayer/blob/189becd8d3935decb17383bd2e61b4909cbddc89/evm/src/circle-relayer/CircleRelayerMessages.sol#L16
export const connectPayload = [
  payloadIdItem(1),
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
] as const;

export const namedPayloads = [
  ["DepositWithPayload", depositWithPayloadLayout()],
  ["TransferWithRelay", depositWithPayloadLayout(connectPayload)],
] as const satisfies NamedPayloads;

// factory registration:
declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"AutomaticCircleBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("AutomaticCircleBridge", namedPayloads);
