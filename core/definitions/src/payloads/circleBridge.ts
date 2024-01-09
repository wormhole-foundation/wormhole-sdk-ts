import { Layout } from "@wormhole-foundation/sdk-base";
import {
  amountItem,
  circleDomainItem,
  circleNonceItem,
  universalAddressItem,
} from "../layout-items";
import "./automaticCircleBridge";
import { NamedPayloads, RegisterPayloadTypes, registerPayloadTypes } from "../vaa";

const messageVersionItem = { binary: "uint", size: 4, custom: 0, omit: true } as const;

// https://developers.circle.com/stablecoin/docs/cctp-technical-reference#message
const circleBurnMessageLayout = [
  // messageBodyVersion is:
  // * immutable: https://github.com/circlefin/evm-cctp-contracts/blob/adb2a382b09ea574f4d18d8af5b6706e8ed9b8f2/src/TokenMessenger.sol#L107
  // * 0: https://etherscan.io/address/0xbd3fa81b58ba92a82136038b25adec7066af3155#readContract
  { name: "messageBodyVersion", ...messageVersionItem },
  { name: "burnToken", ...universalAddressItem },
  { name: "mintRecipient", ...universalAddressItem },
  { name: "amount", ...amountItem },
  { name: "messageSender", ...universalAddressItem },
] as const satisfies Layout;

export const circleMessageLayout = [
  // version is:
  // * immutable: https://github.com/circlefin/evm-cctp-contracts/blob/adb2a382b09ea574f4d18d8af5b6706e8ed9b8f2/src/MessageTransmitter.sol#L75
  // * 0: https://etherscan.io/address/0x0a992d191deec32afe36203ad87d7d289a738f81#readContract
  { name: "version", ...messageVersionItem },
  { name: "sourceDomain", ...circleDomainItem },
  { name: "destinationDomain", ...circleDomainItem },
  { name: "nonce", ...circleNonceItem },
  { name: "sender", ...universalAddressItem },
  { name: "recipient", ...universalAddressItem },
  { name: "destinationCaller", ...universalAddressItem },
  // TODO: is this the only message body we'll get?
  { name: "payload", binary: "object", layout: circleBurnMessageLayout },
] as const satisfies Layout;

export const namedPayloads = [["Message", circleMessageLayout]] as const satisfies NamedPayloads;

// factory registration:
declare global {
  namespace WormholeNamespace {
    interface PayloadLiteralToLayoutMapping
      extends RegisterPayloadTypes<"CircleBridge", typeof namedPayloads> {}
  }
}

registerPayloadTypes("CircleBridge", namedPayloads);
