import { Platform } from "@wormhole-foundation/sdk-base";
import "../payloads/automaticTokenBridge";
import "../payloads/tokenBridge";
import { EmptyPlatformMap } from "../protocol";
import { ProtocolPayload, ProtocolVAA } from "../vaa";

declare global {
  namespace Wormhole {
    export interface ProtocolToPlatformMapping {
      NTT: EmptyPlatformMap<Platform, NTT.ProtocolName>;
    }
  }
}

/**
 * @namespace TokenBridge
 */
export namespace NTT {
  const _protocol = "NTT";
  /** The compile time type of the NTT protocol */
  export type ProtocolName = typeof _protocol;

  const _payloads = ["Transfer"] as const;
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAAs emitted from the NTT protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    ProtocolName,
    PayloadName
  >;
}
