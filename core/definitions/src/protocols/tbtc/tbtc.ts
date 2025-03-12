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

  const _transferPayloads = ["GatewayTransfer", "Transfer"] as const;
  const _payloads = [..._transferPayloads] as const;

  export type TransferPayloadNames = (typeof _transferPayloads)[number];
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAA types emitted by the TBTCBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;
}

export interface TBTCBridge<N extends Network = Network, C extends Chain = Chain> {
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    toGateway?: ChainAddress,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  redeem(sender: AccountAddress<C>, vaa: TBTCBridge.VAA): AsyncGenerator<UnsignedTransaction<N, C>>;

  isTransferCompleted(vaa: TBTCBridge.VAA): Promise<boolean>;
  //   parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}
