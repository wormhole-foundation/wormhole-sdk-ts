import {
  Chain,
  Layout,
  LayoutToType,
  Platform,
  PlatformToChains,
  deserializeLayout,
  encoding
} from "@wormhole-foundation/sdk-base";
import { AccountAddress, ChainAddress } from "../address";
import { CircleMessageId } from "../attestation";
import {
  amountItem,
  circleDomainItem,
  circleNonceItem,
  universalAddressItem
} from "../layout-items";
import "../payloads/connect";
import { RpcConnection } from "../rpc";
import { TokenId } from "../types";
import { UnsignedTransaction } from "../unsignedTransaction";
import { keccak256 } from "../utils";

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

// TODO: convert domain to chain name?
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

export const deserializeCircleMessage = (
  data: Uint8Array,
): [LayoutToType<typeof circleMessageLayout>, string] => {
  const msg = deserializeLayout(circleMessageLayout, data);
  const messsageHash = encoding.hex.encode(keccak256(data), true);
  return [msg, messsageHash];
};

export type CircleTransferMessage = {
  from: ChainAddress;
  to: ChainAddress;
  token: TokenId;
  amount: bigint;
  messageId: CircleMessageId;
};

export interface AutomaticCircleBridge<P extends Platform, C extends Chain = PlatformToChains<P>> {
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<UnsignedTransaction>;
  // TODO: events
}

// https://github.com/circlefin/evm-cctp-contracts
export interface CircleBridge<P extends Platform, C extends Chain = PlatformToChains<P>> {
  redeem(
    sender: AccountAddress<C>,
    message: string,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction>;
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<UnsignedTransaction>;
  parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}

export interface SupportsCircleBridge<P extends Platform> {
  getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>>;
}

export function supportsCircleBridge<P extends Platform>(
  thing: SupportsCircleBridge<P> | any,
): thing is SupportsCircleBridge<P> {
  return typeof (<SupportsCircleBridge<P>>thing).getCircleBridge === "function";
}

export interface SupportsAutomaticCircleBridge<P extends Platform> {
  getAutomaticCircleBridge(
    rpc: RpcConnection<P>,
  ): Promise<AutomaticCircleBridge<P>>;
}

export function supportsAutomaticCircleBridge<P extends Platform>(
  thing: SupportsAutomaticCircleBridge<P> | any,
): thing is SupportsAutomaticCircleBridge<P> {
  return (
    typeof (<SupportsAutomaticCircleBridge<P>>thing)
      .getAutomaticCircleBridge === "function"
  );
}
