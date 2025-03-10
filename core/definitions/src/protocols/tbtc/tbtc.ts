import type { Chain, LayoutToType, Network } from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress } from "../../address.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import type { ProtocolVAA } from "./../../vaa/index.js";
import { tbtcPayloadLayout } from "./tbtcLayout.js";
import type { EmptyPlatformMap } from "../../protocol.js";

import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      TBTCBridge: TBTCBridge<N, C>;
    }
    interface ProtocolToPlatformMapping {
      TBTCBridge: EmptyPlatformMap<"TBTCBridge">;
    }
  }
}

export namespace TBTCBridge {
  const _protocol = "TBTCBridge";
  export type ProtocolName = typeof _protocol;

  const _payloads = ["Transfer"] as const;
  //   const _payloads = [..._transferPayloads] as const;

  //   export type TransferPayloadNames = (typeof _transferPayloads)[number];
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAA types emitted by the PorticoBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type Payload = LayoutToType<typeof tbtcPayloadLayout>;

  // export type Message = LayoutToType<typeof transferWithPayloadLayout>;

  //export type Attestation = {
  //  message: Message;
  //  attestation?: string;
  //};

  //export const isCircleAttestation = (thing: any): thing is Attestation => {
  //  return (<Attestation>thing).message !== undefined;
  //};

  //export const deserialize = (data: Uint8Array): [CircleBridge.Message, string] => {
  //  const msg = deserializeLayout(circleMessageLayout, data);
  //  const messsageHash = encoding.hex.encode(keccak256(data), true);
  //  return [msg, messsageHash];
  //};

  //export const serialize = (msg: CircleBridge.Message): Uint8Array => {
  //  return serializeLayout(circleMessageLayout, msg);
  //};
}

export interface TBTCBridge<N extends Network = Network, C extends Chain = Chain> {
  //redeem(
  //  sender: AccountAddress<C>,
  //  message: TBTCBridge.Message,
  //  attestation: string,
  //): AsyncGenerator<UnsignedTransaction<N, C>>;
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  //   isTransferCompleted(message: CircleBridge.Message): Promise<boolean>;
  //   parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}
