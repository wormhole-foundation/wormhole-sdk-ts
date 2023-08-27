import { ChainName } from "@wormhole-foundation/sdk-base";
import { VAA } from "./vaa";
import { UniversalAddress } from "./universalAddress";
import { SequenceId } from "./types";

// Wormhole Message Identifier
// used to fetch a VAA
export type WormholeMessageId = {
  chain: ChainName;
  emitter: UniversalAddress;
  sequence: SequenceId;
};
export function isWormholeMessageId(
  thing: WormholeMessageId | any
): thing is WormholeMessageId {
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
  msgHash: string;
};
export function isCircleMessageId(
  thing: CircleMessageId | any
): thing is CircleMessageId {
  return (<CircleMessageId>thing).msgHash !== undefined;
}

// No parsing
export type CircleAttestation = string;

export type getCircleAttestation = (
  id: CircleMessageId
) => Promise<CircleAttestation>;
