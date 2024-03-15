import { amountItem, payloadIdItem, universalAddressItem } from "./../../layout-items/index.js";
import type { NamedPayloads, RegisterPayloadTypes } from "./../../vaa/index.js";
import { registerPayloadTypes } from "./../../vaa/index.js";
import { transferWithPayloadLayout } from "./tokenBridgeLayout.js";

//from here:
// https://github.com/wormhole-foundation/example-token-bridge-relayer/blob/1a04ec51f4cfded04e59160bcf2e64aa29dea1f3/evm/src/token-bridge-relayer/TokenBridgeRelayer.sol#L260-L267
export const connectPayload = [
  payloadIdItem(1),
  { name: "targetRelayerFee", ...amountItem },
  { name: "toNativeTokenAmount", ...amountItem },
  { name: "targetRecipient", ...universalAddressItem },
] as const;

export const automaticTokenBridgeNamedPayloads = [
  ["TransferWithRelay", transferWithPayloadLayout(connectPayload)],
] as const satisfies NamedPayloads;

// factory registration:
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<
        "AutomaticTokenBridge",
        typeof automaticTokenBridgeNamedPayloads
      > {}
  }
}

registerPayloadTypes("AutomaticTokenBridge", automaticTokenBridgeNamedPayloads);
