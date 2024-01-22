import { Layout } from "@wormhole-foundation/sdk-base";
import { amountItem, universalAddressItem } from "../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

export const porticoFlagSetLayout = [
  { name: "recipientChain", binary: "uint", endianness: "little", size: 2 },
  { name: "bridgeNonce", binary: "uint", endianness: "little", size: 4 },
  { name: "feeTierStart", binary: "uint", endianness: "little", size: 3 },
  { name: "feeTierFinish", binary: "uint", endianness: "little", size: 3 },
  { name: "padding", binary: "bytes", size: 19 },
  { name: "bitset", binary: "uint", size: 1 },
] as const satisfies Layout;

export const porticoTransferLayout = [
  { name: "flagSet", binary: "object", layout: porticoFlagSetLayout },
  { name: "startTokenAddress", ...universalAddressItem },
  { name: "cannonAssetAmount", ...amountItem },
  { name: "finalTokenAddress", ...universalAddressItem },
  { name: "recipientAddress", ...universalAddressItem },
  { name: "destinationPorticoAddress", ...universalAddressItem },
  { name: "amountSpecified", ...amountItem },
  { name: "minAmountStart", ...amountItem },
  { name: "minAmountFinish", ...amountItem },
  { name: "relayerFee", ...amountItem },
] as const satisfies Layout;

export const porticoPayloadLayout = [
  { name: "flagSet", binary: "object", layout: porticoFlagSetLayout },
  { name: "finalTokenAddress", ...universalAddressItem },
  { name: "recipientAddress", ...universalAddressItem },
  { name: "cannonAssetAmount", ...amountItem },
  { name: "minAmountFinish", ...amountItem },
  { name: "relayerFee", ...amountItem },
] as const satisfies Layout;

export const namedPayloads = [["Transfer", porticoFlagSetLayout]] as const satisfies NamedPayloads;

// factory registration:
declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"PorticoBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("PorticoBridge", namedPayloads);
