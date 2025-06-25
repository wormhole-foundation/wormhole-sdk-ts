import type {
  Commitment,
  Connection,
  PublicKeyInitData,
} from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { ChainId } from '@wormhole-foundation/sdk-connect';
import { UniversalAddress } from '@wormhole-foundation/sdk-connect';
import { utils } from '@wormhole-foundation/sdk-solana';

export function deriveEndpointKey(
  tokenBridgeProgramId: PublicKeyInitData,
  emitterChain: number | ChainId,
  emitterAddress: Buffer | Uint8Array | string,
): PublicKey {
  const emitterAddr =
    typeof emitterAddress === 'string'
      ? new UniversalAddress(emitterAddress).toUint8Array()
      : emitterAddress;

  return utils.deriveAddress(
    [
      (() => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(emitterChain as number);
        return buf;
      })(),
      emitterAddr,
    ],
    tokenBridgeProgramId,
  );
}

export async function getEndpointRegistration(
  connection: Connection,
  endpointKey: PublicKeyInitData,
  commitment?: Commitment,
): Promise<EndpointRegistration> {
  return connection
    .getAccountInfo(new PublicKey(endpointKey), commitment)
    .then((info) =>
      EndpointRegistration.deserialize(utils.getAccountData(info)),
    );
}

export class EndpointRegistration {
  chain: ChainId;
  contract: Buffer;

  constructor(chain: number, contract: Buffer) {
    this.chain = chain as ChainId;
    this.contract = contract;
  }

  static deserialize(data: Buffer): EndpointRegistration {
    if (data.length != 34) {
      throw new Error('data.length != 34');
    }
    const chain = data.readUInt16LE(0);
    const contract = data.subarray(2, 34);
    return new EndpointRegistration(chain, contract);
  }
}
