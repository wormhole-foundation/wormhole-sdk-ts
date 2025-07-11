import { universalAddressItem } from "../../layout-items/index.js";
import type { NamedPayloads, RegisterPayloadTypes } from "../../vaa/index.js";
import { registerPayloadTypes } from "../../vaa/index.js";
import { transferWithPayloadLayout } from "./tokenBridgeLayout.js";

export const payload = [{ name: "targetRecipient", ...universalAddressItem }] as const;

export const executorTokenBridgeNamedPayloads = [
  ["TransferWithExecutorRelay", transferWithPayloadLayout(payload)],
] as const satisfies NamedPayloads;

// factory registration:
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<
        "ExecutorTokenBridge",
        typeof executorTokenBridgeNamedPayloads
      > {}
  }
}

registerPayloadTypes("ExecutorTokenBridge", executorTokenBridgeNamedPayloads);
