import {
  Layout,
  LayoutToType,
  CombineObjects,
  FlexBytesLayoutItem,
} from "@wormhole-foundation/sdk-base";

import { universalAddressItem, chainItem, sequenceItem } from "../layout-items";

export const normalizedAmountLayout = [
  {name: "decimals", binary: "uint", size: 1},
  {name: "amount", binary: "uint", size: 8},
] as const satisfies Layout;

export type NormalizedAmount = LayoutToType<typeof normalizedAmountLayout>;

export type Prefix = readonly [number, number, number, number];

const prefixLayout = <const P extends Prefix>(prefix: P) => [
  {name: "prefix", binary: "bytes", custom: Uint8Array.from(prefix), omit: true},
] as const satisfies Layout;

export const nativeTokenTransferLayout = [
  ...prefixLayout([0x99, 0x4E, 0x54, 0x54]),
  {name: "normalizedAmount", binary: "bytes", custom: normalizedAmountLayout},
  {name: "sourceToken", ...universalAddressItem},
  {name: "recipientAddress", ...universalAddressItem},
  {name: "recipientChain", ...chainItem()},
] as const satisfies Layout;

export type NativeTokenTransfer = LayoutToType<typeof nativeTokenTransferLayout>;

export const endpointMessageBaseLayout = <const PF extends Prefix>(prefix: PF) => [
  ...prefixLayout(prefix),
  {name: "sourceManager", ...universalAddressItem},
] as const satisfies Layout;

export const endpointMessageLayout = <
  const PF extends Prefix,
  const P extends FlexBytesLayoutItem["custom"] = undefined,
>(prefix: PF, customPayload?: P) => [
  ...endpointMessageBaseLayout(prefix),
  {name: "managerPayload", binary: "bytes", lengthSize: 2, custom: customPayload as P},
] as const satisfies Layout;

type EndpointMessageBase = LayoutToType<ReturnType<typeof endpointMessageBaseLayout<Prefix>>>;

export type EndpointMessage<P> = CombineObjects<EndpointMessageBase, {managerPayload: P}>;

export const managerMessageLayoutBase = [
  {name: "sequence", ...sequenceItem},
  {name: "sender", ...universalAddressItem},
] as const satisfies Layout;

type ManagerMessageBase = LayoutToType<typeof managerMessageLayoutBase>;

export const managerMessageLayout = <
  const P extends FlexBytesLayoutItem["custom"] = undefined
>(customPayload?: P) => [
  ...managerMessageLayoutBase,
  {name: "payload", binary: "bytes", lengthSize: 2, custom: customPayload as P},
] as const satisfies Layout;

export type ManagerMessage<P> = CombineObjects<ManagerMessageBase, {payload: P}>;

export const wormholeEndpointMessage = <
  const P extends FlexBytesLayoutItem["custom"] = undefined
>(customPayload?: P) =>
  endpointMessageLayout([0x99, 0x45, 0xFF, 0x10], customPayload);

export type WormholeEndpointMessage<P> = EndpointMessage<P>;
