import type { Chain } from "@wormhole-foundation/sdk-base";
import type { ProtocolName } from "./protocol.js";
import type { AutomaticCircleBridge, CircleBridge } from "./protocols/circleBridge/circleBridge.js";
import type { IbcTransferData } from "./protocols/ibc/ibc.js";
import type { PorticoBridge } from "./protocols/portico/portico.js";
import type { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge/tokenBridge.js";
import type { SequenceId } from "./types.js";
import type { UniversalAddress } from "./universalAddress.js";
import type { VAA } from "./vaa/index.js";

/**
 * The Identifier of an attestation, useful to look up the full attestation
 */
export type AttestationId<PN extends ProtocolName = ProtocolName> = PN extends
  | "TokenBridge"
  | "AutomaticTokenBridge"
  | "WormholeCore"
  | "PorticoBridge"
  | "AutomaticCircleBridge"
  ? WormholeMessageId
  : PN extends "AutomaticCircleBridge"
  ? WormholeMessageId | CircleMessageId
  : PN extends "CircleBridge"
  ? CircleMessageId
  : PN extends "IbcBridge"
  ? IbcMessageId
  : any;

/**
 * The full attestation that represents evidence of a transaction
 */
export type Attestation<PN extends ProtocolName = ProtocolName> = PN extends
  | "TokenBridge"
  | "AutomaticTokenBridge"
  ? AutomaticTokenBridge.VAA | TokenBridge.VAA
  : PN extends "AutomaticCircleBridge"
  ? AutomaticCircleBridge.VAA | CircleBridge.Attestation
  : PN extends "CircleBridge"
  ? CircleBridge.Attestation
  : PN extends "IbcBridge"
  ? IbcTransferData
  : PN extends "WormholeCore"
  ? VAA<"Uint8Array">
  : PN extends "PorticoBridge"
  ? PorticoBridge.VAA
  : any;

/**
 * Wormhole Message Identifier used to fetch a VAA
 */
export type WormholeMessageId = {
  chain: Chain;
  emitter: UniversalAddress;
  sequence: SequenceId;
};
export function isWormholeMessageId(thing: WormholeMessageId | any): thing is WormholeMessageId {
  return (
    (<WormholeMessageId>thing).sequence !== undefined &&
    (<WormholeMessageId>thing).emitter !== undefined &&
    (<WormholeMessageId>thing).chain !== undefined
  );
}

export type getWormholeAttestation = (id: WormholeMessageId) => Promise<VAA>;

/**
 * Circle Message Identifier
 * Used to fetch a Circle attestation
 */
export type CircleMessageId = {
  hash: string;
};
export function isCircleMessageId(thing: CircleMessageId | any): thing is CircleMessageId {
  return (<CircleMessageId>thing).hash !== undefined;
}

/** Attestation from circle attestation api */
export type CircleAttestation = string;

export type getCircleAttestation = (id: CircleMessageId) => Promise<CircleAttestation>;

/**
 * Ibc Message Identifier
 * Used to fetch a Ibc attestation
 */
export type IbcMessageId = {
  chain: Chain;
  srcPort: string;
  srcChannel: string;
  dstPort: string;
  dstChannel: string;
  sequence: number;
};
export function isIbcMessageId(thing: IbcMessageId | any): thing is IbcMessageId {
  return (
    (<IbcMessageId>thing).dstChannel !== undefined &&
    (<IbcMessageId>thing).srcChannel !== undefined &&
    (<IbcMessageId>thing).chain !== undefined &&
    (<IbcMessageId>thing).srcPort !== undefined &&
    (<IbcMessageId>thing).dstPort !== undefined &&
    (<IbcMessageId>thing).sequence !== undefined
  );
}
