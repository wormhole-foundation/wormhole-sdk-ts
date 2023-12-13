import { Chain } from "@wormhole-foundation/sdk-base";
import { SequenceId } from "./types";
import { UniversalAddress } from "./universalAddress";
import { PayloadLiteral, VAA } from "./vaa";

// Wormhole Message Identifier
// used to fetch a VAA
export type WormholeMessageId<PL extends PayloadLiteral = PayloadLiteral> = {
  chain: Chain;
  emitter: UniversalAddress;
  sequence: SequenceId;
  vaa?: VAA<PL>;
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
  message: string;
  hash: string;
};
export function isCircleMessageId(thing: CircleMessageId | any): thing is CircleMessageId {
  return (
    (<CircleMessageId>thing).message !== undefined && (<CircleMessageId>thing).hash !== undefined
  );
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
