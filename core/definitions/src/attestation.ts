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
  return (<WormholeMessageId>thing).sequence !== undefined;
}

export type getWormholeAttestation = (id: WormholeMessageId) => Promise<VAA>;

// Circle Message Identifier
// Used to fetch a Circle attestation
export type CircleMessageId = {
  msgHash: string;
};
export function isCircleMessageId(
  thing: CircleMessageId | any
): thing is CircleMessageId {
  return (<CircleMessageId>thing).msgHash !== undefined;
}

export type CircleAttestation = {
  message: string;
  attestation: string;
};

export type getCircleAttestation = (
  id: CircleMessageId
) => Promise<CircleAttestation>;
