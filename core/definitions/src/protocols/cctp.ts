import {
  PlatformName,
  CircleChainId,
  Layout,
  deserializeLayout,
  uint8ArrayToHexByteString,
  LayoutToType,
} from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { CircleMessageId } from "../attestation";
import { UnsignedTransaction } from "../unsignedTransaction";
import { TokenId, TxHash } from "../types";
import "../payloads/connect";
import { RpcConnection } from "../rpc";
import { universalAddressItem } from "../layout-items";
import { keccak256 } from "../utils";

// https://developers.circle.com/stablecoin/docs/cctp-technical-reference#message
export const circleMessageLayout: Layout = [
  { name: "version", binary: "uint", size: 4 },
  { name: "sourceDomain", binary: "uint", size: 4 },
  { name: "destinationDomain", binary: "uint", size: 4 },
  { name: "nonce", binary: "uint", size: 8 },
  { name: "sender", ...universalAddressItem },
  { name: "recipient", ...universalAddressItem },
  { name: "destinationCaller", ...universalAddressItem },
  { name: "messageBody", binary: "bytes" },
];

export const circleBurnMessageLayout: Layout = [
  { name: "version", binary: "uint", size: 4 },
  { name: "burnToken", ...universalAddressItem },
  { name: "mintRecipient", ...universalAddressItem },
  { name: "amount", binary: "uint", size: 32 },
  { name: "messageSender", ...universalAddressItem },
];

export const deserializeCircleMessage = (
  data: Uint8Array,
): [
  LayoutToType<typeof circleMessageLayout>,
  LayoutToType<typeof circleBurnMessageLayout>,
  string,
] => {
  const msg = deserializeLayout(circleMessageLayout, data);
  // Expect a body message, only Burn atm
  if (msg.messageBody.length === 0) throw new Error("empty message body");
  const burnMsg = deserializeLayout(circleBurnMessageLayout, msg.messageBody);
  const messsageHash = uint8ArrayToHexByteString(keccak256(data));
  return [msg, burnMsg, messsageHash];
};

export type CircleTransferMessage = {
  from: ChainAddress;
  to: ChainAddress;
  token: TokenId;
  amount: bigint;
  messageId: CircleMessageId;
};

export interface AutomaticCircleBridge<P extends PlatformName> {
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<UnsignedTransaction>;
  // TODO: events
}

// https://github.com/circlefin/evm-cctp-contracts
export interface CircleBridge<P extends PlatformName> {
  redeem(
    sender: UniversalOrNative<P>,
    message: string,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction>;
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<UnsignedTransaction>;
  parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}

export interface SupportsCircleBridge<P extends PlatformName> {
  getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>>;
}

export function supportsCircleBridge<P extends PlatformName>(
  thing: SupportsCircleBridge<P> | any,
): thing is SupportsCircleBridge<P> {
  return typeof (<SupportsCircleBridge<P>>thing).getCircleBridge === "function";
}

export interface SupportsAutomaticCircleBridge<P extends PlatformName> {
  getAutomaticCircleBridge(
    rpc: RpcConnection<P>,
  ): Promise<AutomaticCircleBridge<P>>;
}

export function supportsAutomaticCircleBridge<P extends PlatformName>(
  thing: SupportsAutomaticCircleBridge<P> | any,
): thing is SupportsAutomaticCircleBridge<P> {
  return (
    typeof (<SupportsAutomaticCircleBridge<P>>thing)
      .getAutomaticCircleBridge === "function"
  );
}
