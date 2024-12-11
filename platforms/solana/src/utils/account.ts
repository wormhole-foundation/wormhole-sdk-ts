import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import * as spl from '@solana/spl-token';

type Seed = string | Uint8Array;

/**
 * Find the first valid program address. See {@link PublicKey.findProgramAddressSync} for details.
 *
 * @param {string | Uint8Array |
 *         readonly (string | Uint8Array)[]} seeds - seeds for PDA
 * @param {PublicKeyInitData} programId - program address
 * @returns PDA
 */
export function deriveAddress(
  seeds: Seed | readonly Seed[],
  programId: PublicKeyInitData,
): PublicKey {
  const toBytes = (s: Seed) => (typeof s === 'string' ? Buffer.from(s) : s);

  return PublicKey.findProgramAddressSync(
    Array.isArray(seeds) ? seeds.map(toBytes) : [toBytes(seeds as Seed)],
    new PublicKey(programId),
  )[0];
}

/**
 * Allows to create an `AccountMeta` object with a simplified syntax. By default,
 * `isSigner` and `isWritable` are false, and they can be activated with a function:
 *
 * - `meta(pubkey)`: non signer, non writable;
 * - `meta(pubkey).signer()`: signer only, non writable;
 * - `meta(pubkey).writable()`: writable only, non signer;
 * - `meta(pubkey).signer().writable()` or `meta(pubkey).writable().signer()`.
 * @param pubkey The public key used to create the meta object.
 * @returns
 */
export function meta(pubkey: PublicKeyInitData) {
  class AccountMetaBuilder {
    constructor(
      public pubkey: PublicKey,
      public isSigner: boolean = false,
      public isWritable: boolean = false,
    ) {}

    public signer() {
      return new AccountMetaSigner(this.pubkey);
    }

    public writable() {
      return new AccountMetaWritable(this.pubkey);
    }
  }

  class AccountMetaSigner {
    constructor(
      public pubkey: PublicKey,
      public isSigner: boolean = true,
      public isWritable: boolean = false,
    ) {}

    public writable() {
      return new AccountMetaSignerWritable(this.pubkey);
    }
  }

  class AccountMetaWritable {
    constructor(
      public pubkey: PublicKey,
      public isSigner: boolean = false,
      public isWritable: boolean = true,
    ) {}

    public signer() {
      return new AccountMetaSignerWritable(this.pubkey);
    }
  }

  class AccountMetaSignerWritable {
    constructor(
      public pubkey: PublicKey,
      public isSigner: boolean = true,
      public isWritable: boolean = true,
    ) {}
  }

  return new AccountMetaBuilder(new PublicKey(pubkey));
}

export function isNativeMint(mintAddress: PublicKeyInitData): boolean {
  const mint = new PublicKey(mintAddress);
  return mint.equals(spl.NATIVE_MINT) || mint.equals(spl.NATIVE_MINT_2022);
}
