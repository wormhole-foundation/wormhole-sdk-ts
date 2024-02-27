import {
  Layout,
  LayoutToType,
  CustomizableBytes,
  customizableBytes,
} from "@wormhole-foundation/sdk-base";

import { universalAddressItem, chainItem, sequenceItem } from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

export const normalizedAmountLayout = [
  { name: "decimals", binary: "uint", size: 1 },
  { name: "amount", binary: "uint", size: 8 },
] as const satisfies Layout;

export type NormalizedAmount = LayoutToType<typeof normalizedAmountLayout>;

export type Prefix = readonly [number, number, number, number];

const prefixItem = (prefix: Prefix) =>
  ({ name: "prefix", binary: "bytes", custom: Uint8Array.from(prefix), omit: true }) as const;

export const nativeTokenTransferLayout = [
  prefixItem([0x99, 0x4e, 0x54, 0x54]),
  { name: "normalizedAmount", binary: "bytes", layout: normalizedAmountLayout },
  { name: "sourceToken", ...universalAddressItem },
  { name: "recipientAddress", ...universalAddressItem },
  { name: "recipientChain", ...chainItem() },
] as const satisfies Layout;

export type NativeTokenTransfer = LayoutToType<typeof nativeTokenTransferLayout>;

export const endpointMessageLayout = <const P extends CustomizableBytes = undefined>(
  prefix: Prefix,
  customPayload?: P,
) =>
  [
    prefixItem(prefix),
    { name: "sourceManager", ...universalAddressItem },
    customizableBytes({ name: "managerPayload", lengthSize: 2 }, customPayload),
  ] as const satisfies Layout;

export type EndpointMessage<P extends CustomizableBytes = undefined> = LayoutToType<
  ReturnType<typeof endpointMessageLayout<P>>
>;

export const managerMessageLayout = <const P extends CustomizableBytes = undefined>(
  customPayload?: P,
) =>
  [
    { name: "sequence", ...sequenceItem },
    { name: "sender", ...universalAddressItem },
    customizableBytes({ name: "payload", lengthSize: 2 }, customPayload),
  ] as const satisfies Layout;

export type ManagerMessage<P extends CustomizableBytes = undefined> = LayoutToType<
  ReturnType<typeof managerMessageLayout<P>>
>;

export const wormholeEndpointMessage = <const P extends CustomizableBytes = undefined>(
  customPayload?: P,
) => endpointMessageLayout([0x99, 0x45, 0xff, 0x10], customPayload);

export type WormholeEndpointMessage<P extends CustomizableBytes = undefined> = LayoutToType<
  ReturnType<typeof wormholeEndpointMessage<P>>
>;

export const namedPayloads = [
  ["Transfer", nativeTokenTransferLayout],
] as const satisfies NamedPayloads;

declare global {
  namespace Wormhole {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"NTT", typeof namedPayloads> {}
  }
}

registerPayloadTypes("NTT", namedPayloads);
