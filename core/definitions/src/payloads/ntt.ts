import {
  Layout,
  LayoutToType,
  CustomizableBytes,
  customizableBytes,
} from "@wormhole-foundation/sdk-base";

import { universalAddressItem, chainItem, sequenceItem } from "../layout-items";

export const trimmedAmountLayout = [
  {name: "decimals", binary: "uint", size: 1},
  {name: "amount", binary: "uint", size: 8},
] as const satisfies Layout;

export type TrimmedAmount = LayoutToType<typeof trimmedAmountLayout>;

export type Prefix = readonly [number, number, number, number];

const prefixItem = (prefix: Prefix) =>
  ({name: "prefix", binary: "bytes", custom: Uint8Array.from(prefix), omit: true} as const);

export const nativeTokenTransferLayout = [
  prefixItem([0x99, 0x4E, 0x54, 0x54]),
  {name: "trimmedAmount", binary: "bytes", layout: trimmedAmountLayout},
  {name: "sourceToken", ...universalAddressItem},
  {name: "recipientAddress", ...universalAddressItem},
  {name: "recipientChain", ...chainItem()}, //TODO restrict to supported chains?
] as const satisfies Layout;

export type NativeTokenTransfer = LayoutToType<typeof nativeTokenTransferLayout>;

export const transceiverMessageLayout = <
  const P extends CustomizableBytes = undefined,
>(prefix: Prefix, customPayload?: P) => [
  prefixItem(prefix),
  {name: "sourceNttManager", ...universalAddressItem},
  {name: "recipientNttManager", ...universalAddressItem},
  customizableBytes({name: "nttManagerPayload", lengthSize: 2}, customPayload),
] as const satisfies Layout;

export type TransceiverMessage<P extends CustomizableBytes = undefined> =
  LayoutToType<ReturnType<typeof transceiverMessageLayout<P>>>;

export const nttManagerMessageLayout = <
  const P extends CustomizableBytes = undefined
>(customPayload?: P) => [
  {name: "sequence", ...sequenceItem},
  {name: "sender", ...universalAddressItem},
  customizableBytes({name: "payload", lengthSize: 2}, customPayload),
] as const satisfies Layout;

export type NttManagerMessage<P extends CustomizableBytes = undefined> =
  LayoutToType<ReturnType<typeof nttManagerMessageLayout<P>>>;

export const wormholeTransceiverMessage = <
  const P extends CustomizableBytes = undefined
>(customPayload?: P) =>
  transceiverMessageLayout([0x99, 0x45, 0xFF, 0x10], customPayload);

export type WormholeTransceiverMessage<P extends CustomizableBytes = undefined> =
  LayoutToType<ReturnType<typeof wormholeTransceiverMessage<P>>>;
