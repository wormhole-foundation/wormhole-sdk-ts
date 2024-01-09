import { amountItem, payloadIdItem, universalAddressItem } from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";
import { transferWithPayloadLayout } from "./tokenBridge";

//from here:
// https://github.com/wormhole-foundation/example-token-bridge-relayer/blob/1a04ec51f4cfded04e59160bcf2e64aa29dea1f3/evm/src/token-bridge-relayer/TokenBridgeRelayer.sol#L260-L267
export const connectPayload = [
  payloadIdItem(1),
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
] as const;

export const namedPayloads = [
  ["TransferWithRelay", transferWithPayloadLayout({ binary: "object", layout: connectPayload })],
] as const satisfies NamedPayloads;

// factory registration:
declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"AutomaticTokenBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("AutomaticTokenBridge", namedPayloads);
