import type { Layout } from "@wormhole-foundation/sdk-base";
import { universalAddressItem } from "./../../layout-items/index.js";
import type { NamedPayloads, RegisterPayloadTypes } from "./../../vaa/index.js";
import { registerPayloadTypes } from "./../../vaa/index.js";
import { transferLayout, transferWithPayloadLayout } from "../tokenBridge/tokenBridgeLayout.js";

export const tbtcPayloadLayout = [
  { name: "recipient", ...universalAddressItem },
] as const satisfies Layout;

const namedPayloads = [
  // Payload when transferring to a chain with a Tbtc L2WormholeGateway contract
  ["GatewayTransfer", transferWithPayloadLayout(tbtcPayloadLayout)],
  // Payload when transferring to a chain without a Tbtc L2WormholeGateway contract
  // Just a normal token bridge transfer
  ["Transfer", transferLayout],
] as const satisfies NamedPayloads;

// factory registration:
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"TbtcBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("TbtcBridge", namedPayloads);
