import {
  Chain,
  LayoutToType,
  Network,
  Platform,
  PlatformToChains,
  deserializeLayout,
  encoding,
  lazyInstantiate,
  serializeLayout,
} from "@wormhole-foundation/sdk-base";
import { AccountAddress, ChainAddress } from "../address";
import { CircleMessageId } from "../attestation";
import { TokenId } from "../types";
import { UnsignedTransaction } from "../unsignedTransaction";

import "../payloads/automaticCircleBridge";
import { circleMessageLayout } from "../payloads/circleBridge";
import { keccak256 } from "../utils";
import { ProtocolPayload, ProtocolVAA, payloadDiscriminator } from "../vaa";

export namespace CircleBridge {
  const _protocol = "CircleBridge";
  export type ProtocolName = typeof _protocol;

  const _payloads = ["Message"] as const;
  export type PayloadNames = (typeof _payloads)[number];

  export type Message = LayoutToType<typeof circleMessageLayout>;

  export type Attestation = {
    message: Message;
    attestation?: string;
  };

  export const deserialize = (data: Uint8Array): [CircleBridge.Message, string] => {
    const msg = deserializeLayout(circleMessageLayout, data);
    const messsageHash = encoding.hex.encode(keccak256(data), true);
    return [msg, messsageHash];
  };

  export const serialize = (msg: CircleBridge.Message): Uint8Array => {
    return serializeLayout(circleMessageLayout, msg);
  };
}

export namespace AutomaticCircleBridge {
  const _protocol = "AutomaticCircleBridge";
  export type ProtocolName = typeof _protocol;

  const _payloads = ["DepositWithPayload", "TransferWithRelay"] as const;
  export type PayloadNames = (typeof _payloads)[number];

  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    ProtocolName,
    PayloadName
  >;

  export const getTransferDiscriminator = lazyInstantiate(() =>
    payloadDiscriminator([_protocol, _payloads]),
  );
}

export type CircleTransferMessage = {
  from: ChainAddress;
  to: ChainAddress;
  token: TokenId;
  amount: bigint;
  message: CircleBridge.Message;
  id: CircleMessageId;
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

// https://github.com/circlefin/evm-cctp-contracts
export interface CircleBridge<
  N extends Network,
  P extends Platform,
  C extends PlatformToChains<P>,
> {
  redeem(
    sender: AccountAddress<C>,
    message: CircleBridge.Message,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  isTransferCompleted(message: CircleBridge.Message): Promise<boolean>;
  parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
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
}
