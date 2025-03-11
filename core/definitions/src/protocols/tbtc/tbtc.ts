import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress } from "../../address.js";
import type { TokenAddress } from "../../types.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import type { ProtocolVAA } from "./../../vaa/index.js";
import type { EmptyPlatformMap } from "../../protocol.js";

import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      TbtcBridge: TbtcBridge<N, C>;
    }
    interface ProtocolToPlatformMapping {
      TbtcBridge: EmptyPlatformMap<"TbtcBridge">;
    }
  }
}

export namespace TbtcBridge {
  const _protocol = "TbtcBridge";
  export type ProtocolName = typeof _protocol;

  const _transferPayloads = ["GatewayTransfer", "Transfer"] as const;
  const _payloads = [..._transferPayloads] as const;

  export type TransferPayloadNames = (typeof _transferPayloads)[number];
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAA types emitted by the TbtcBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;
}

export interface TbtcBridge<N extends Network = Network, C extends Chain = Chain> {
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    toGateway?: ChainAddress,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  redeem(sender: AccountAddress<C>, vaa: TbtcBridge.VAA): AsyncGenerator<UnsignedTransaction<N, C>>;

  isTransferCompleted(vaa: TbtcBridge.VAA): Promise<boolean>;
  //   parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}
