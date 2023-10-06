import { ChainName } from "@wormhole-foundation/sdk-base";
import { VAA } from "./vaa";
import { UniversalAddress } from "./universalAddress";
import { SequenceId, TransactionId } from "./types";

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

// Raw payload from circle
export type CircleAttestation = string;

// Ibc Message Identifier
// Used to fetch a Ibc attestation
export type IbcMessageId = {
  chain: ChainName;
  port: string;
  srcChannel: string;
  dstChannel: string;
  sequence: number;
};
export function isIbcMessageId(
  thing: IbcMessageId | any
): thing is IbcMessageId {
  return (
    (<IbcMessageId>thing).dstChannel !== undefined &&
    (<IbcMessageId>thing).srcChannel !== undefined &&
    (<IbcMessageId>thing).chain !== undefined &&
    (<IbcMessageId>thing).port !== undefined &&
    (<IbcMessageId>thing).sequence !== undefined
  );
}
