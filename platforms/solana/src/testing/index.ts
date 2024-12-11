export * from './client/token-bridge.js';
export * from './client/wormhole-core.js';
export * from './accountVaaLayout.js';
export * from './helper.js';

import { Keypair, PublicKey, Signer } from '@solana/web3.js';
import { UniversalAddress } from '../../../../core/definitions/src/universalAddress.js';

/**
 * Accepted as public key are:
 * - The Solana `PublicKey`;
 * - The Wormhole `UniversalAddress`;
 * - A type implementing the interface `Signer` from Solana;
 * - Any kind of array of bytes holding a secret key.
 */
export type HasPublicKey =
  | PublicKey
  | UniversalAddress
  | Signer
  | ArrayLike<number>;

/* Returns the public key from a piece of data holding one. */
export function extractPubkey(from: HasPublicKey): PublicKey {
  const isSigner = (from: HasPublicKey): from is Signer =>
    from.hasOwnProperty('publicKey');

  if (from instanceof PublicKey || from?.constructor.name === 'PublicKey') {
    return from as PublicKey;
  } else if (from instanceof UniversalAddress) {
    return new PublicKey(from.toUint8Array());
  } else if (isSigner(from)) {
    return from.publicKey;
  } else {
    return Keypair.fromSecretKey(Uint8Array.from(from)).publicKey;
  }
}
