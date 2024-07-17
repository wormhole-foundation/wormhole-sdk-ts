import type { Chain} from "@wormhole-foundation/sdk-base";
import { guardians } from "@wormhole-foundation/sdk-base";
import type { PayloadLiteral, VAA } from "../../index.js";
import {
  Signature,
  SignatureUtils,
  createVAA,
  deserialize,
  serialize,
} from "../../index.js";
import type { UniversalAddress } from "../../universalAddress.js";
import { keccak256 } from "../../utils.js";

interface Guardian {
  index: number;
  key: string;
}

export class MockGuardians {
  setIndex: number;
  signers: Guardian[];

  constructor(setIndex: number, keys: string[]) {
    this.setIndex = setIndex;
    this.signers = keys.map((key, index): Guardian => {
      return { index, key };
    });
  }

  getPublicKeys() {
    return this.signers.map((guardian) => SignatureUtils.toPubkey(guardian.key));
  }

  addSignatures<P extends PayloadLiteral>(
    message: Uint8Array | VAA<P>,
    guardianIndices?: number[],
  ) {
    if (!guardianIndices || guardianIndices.length === 0)
      guardianIndices = Array.from(Array(this.signers.length).keys());

    const signers = this.signers.filter((signer) => guardianIndices.includes(signer.index));

    const vaa = message instanceof Uint8Array ? deserialize("Uint8Array", message) : message;

    if (vaa.guardianSet === 0)
      // @ts-expect-error -- wants readonly
      vaa.guardianSet = this.setIndex;

    if (vaa.guardianSet != this.setIndex)
      throw new Error(`Mismatched guardian set index: ${vaa.guardianSet} != ${this.setIndex}`);

    for (let i = 0; i < signers.length; ++i) {
      const signer = signers.at(i);
      if (!signer) throw Error("No signer with index: " + i);

      const signature = SignatureUtils.sign(signer.key, keccak256(vaa.hash));
      const s = new Signature(signature.r, signature.s, signature.recovery);

      // @ts-expect-error -- wants readonly
      vaa.signatures.push({ guardianIndex: i, signature: s });
    }

    return vaa;
  }

  setSignatures<P extends PayloadLiteral>(message: Uint8Array | VAA<P>) {
    const vaa = message instanceof Uint8Array ? deserialize("Uint8Array", message) : message;

    // @ts-expect-error -- wants readonly
    vaa.signatures = [];

    return this.addSignatures<typeof vaa.payloadLiteral>(vaa);
  }
}

export class MockEmitter {
  chain: Chain;
  address: UniversalAddress;
  sequence: bigint;

  constructor(emitterAddress: UniversalAddress, chain: Chain, startSequence?: bigint) {
    this.chain = chain;
    this.address = emitterAddress;
    this.sequence = startSequence == undefined ? 0n : startSequence;
  }

  publishMessage(
    nonce: number,
    payload: Uint8Array,
    consistencyLevel: number,
    timestamp?: number,
    uptickSequence: boolean = true,
  ) {
    if (uptickSequence) {
      ++this.sequence;
    }

    return serialize(
      createVAA("Uint8Array", {
        guardianSet: 0,
        signatures: [],
        nonce: nonce,
        timestamp: timestamp ?? 0,
        sequence: this.sequence,
        emitterChain: this.chain,
        emitterAddress: this.address,
        consistencyLevel: consistencyLevel,
        payload: payload,
      }),
    );
  }
}

export const devnetGuardianSet = () => new MockGuardians(0, [guardians.devnetGuardianPrivateKey]);
