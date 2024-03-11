import { Layout, bitsetItem } from "@wormhole-foundation/sdk-base";
import { amountItem, universalAddressItem } from "../../layout-items";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../../vaa";

//weirdly, if defined in place, the type is not inferred properly
const flagsItem = bitsetItem(["shouldWrapNative", "shouldUnwrapNative"]);

export const porticoFlagSetLayout = [
  { name: "recipientChain", binary: "uint", endianness: "little", size: 2 },
  { name: "bridgeNonce", binary: "uint", endianness: "little", size: 4 },
  { name: "feeTierStart", binary: "uint", endianness: "little", size: 3 },
  { name: "feeTierFinish", binary: "uint", endianness: "little", size: 3 },
  { name: "padding", binary: "bytes", size: 19 },
  { name: "flags", ...flagsItem },
] as const satisfies Layout;

export const porticoTransferLayout = [
  { name: "flagSet", binary: "bytes", layout: porticoFlagSetLayout },
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
  { name: "flagSet", binary: "bytes", layout: porticoFlagSetLayout },
  { name: "finalTokenAddress", ...universalAddressItem },
  { name: "recipientAddress", ...universalAddressItem },
  { name: "cannonAssetAmount", ...amountItem },
  { name: "minAmountFinish", ...amountItem },
  { name: "relayerFee", ...amountItem },
] as const satisfies Layout;

export const namedPayloads = [["Transfer", porticoFlagSetLayout]] as const satisfies NamedPayloads;

// factory registration:
import "../../registry";
declare module "../../registry" {
  export namespace WormholeRegistry {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"PorticoBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("PorticoBridge", namedPayloads);
