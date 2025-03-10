import type { Layout } from "@wormhole-foundation/sdk-base";
import { universalAddressItem } from "./../../layout-items/index.js";
import type { NamedPayloads, RegisterPayloadTypes } from "./../../vaa/index.js";
import { registerPayloadTypes } from "./../../vaa/index.js";
import { transferWithPayloadLayout } from "../tokenBridge/tokenBridgeLayout.js";

export const tbtcPayloadLayout = [
  { name: "recipient", ...universalAddressItem }, // recipient wallet address
] as const satisfies Layout;

export const namedPayloads = [
  ["Transfer", transferWithPayloadLayout(tbtcPayloadLayout)],
] as const satisfies NamedPayloads;

// factory registration:
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"TBTCBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("TBTCBridge", namedPayloads);
