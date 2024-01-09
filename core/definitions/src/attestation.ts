import { Chain, ProtocolName } from "@wormhole-foundation/sdk-base";
import { SequenceId } from "./types";
import { UniversalAddress } from "./universalAddress";
import { VAA } from "./vaa";
import { AutomaticTokenBridge, TokenBridge } from "./protocols/tokenBridge";
import { AutomaticCircleBridge, CircleBridge } from "./protocols/circleBridge";
import { IbcTransferData } from "./protocols/ibc";

// Could be VAA or Circle or ..?
export type AttestationId<PN extends ProtocolName = ProtocolName> = PN extends
  | "TokenBridge"
  | "AutomaticTokenBridge"
  | "AutomaticCircleBridge"
  ? WormholeMessageId
  : PN extends "CircleBridge"
  ? CircleMessageId
  : PN extends "IbcBridge"
  ? IbcMessageId
  : never;

export type Attestation<PN extends ProtocolName = ProtocolName> = PN extends
  | "TokenBridge"
  | "AutomaticTokenBridge"
  ? AutomaticTokenBridge.VAA | TokenBridge.VAA
  : PN extends "AutomaticCircleBridge"
  ? AutomaticCircleBridge.VAA
  : PN extends "CircleBridge"
  ? CircleBridge.Attestation
  : PN extends "IbcBridge"
  ? IbcTransferData
  : never;

// Attestation Receipt contains the Id to lookup the attestation
// and possibly a cached/parsed attestation
export type AttestationReceipt<PN extends ProtocolName = ProtocolName> = {
  id: AttestationId<PN>;
  attestation?: Attestation<PN>;
};

// Wormhole Message Identifier used to fetch a VAA
// Possibly with a VAA already set
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

// Circle Message Identifier
// Used to fetch a Circle attestation
export type CircleMessageId = {
  hash: string;
};
export function isCircleMessageId(thing: CircleMessageId | any): thing is CircleMessageId {
  return (<CircleMessageId>thing).hash !== undefined;
}

// Raw payload from circle
export type CircleAttestation = string;

export type getCircleAttestation = (id: CircleMessageId) => Promise<CircleAttestation>;

// Ibc Message Identifier
// Used to fetch a Ibc attestation
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
