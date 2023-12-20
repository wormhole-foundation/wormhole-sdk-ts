import {
  Chain,
  Layout,
  LayoutToType,
  Network,
  Platform,
  PlatformToChains,
  deserializeLayout,
  encoding,
} from "@wormhole-foundation/sdk-base";
import { AccountAddress, ChainAddress } from "../address";
import { CircleMessageId } from "../attestation";
import {
  amountItem,
  circleDomainItem,
  circleNonceItem,
  universalAddressItem,
} from "../layout-items";
import "../payloads/connect";
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

export type CircleMessage = LayoutToType<typeof circleMessageLayout>;

export const deserializeCircleMessage = (data: Uint8Array): [CircleMessage, string] => {
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

export type CircleTransferDetails = {
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

export function isCircleTransferDetails(thing: any): thing is CircleTransferDetails {
  return (
    (<CircleTransferDetails>thing).amount !== undefined &&
    (<CircleTransferDetails>thing).from !== undefined &&
    (<CircleTransferDetails>thing).to !== undefined
  );
}

export interface AutomaticCircleBridge<
  N extends Network,
  P extends Platform,
  C extends Chain = PlatformToChains<P>,
> {
  // Return the fee required by the relayer to cover the costs
  // of redemption on the destination chain
  getRelayerFee(destination: Chain): Promise<bigint>;
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  // TODO: events
}

// https://github.com/circlefin/evm-cctp-contracts
export interface CircleBridge<
  N extends Network,
  P extends Platform,
  C extends PlatformToChains<P>,
> {
  redeem(
    sender: AccountAddress<C>,
    message: string,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}
