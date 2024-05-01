import type { Connection, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { Provider } from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { utils } from '@wormhole-foundation/sdk-solana';
import { WormholeCoder } from './coder/index.js';
import type { Wormhole } from '../types.js';

// ts-ignoring because of this nonsense https://github.com/microsoft/TypeScript/issues/51783
/* @ts-ignore */
import IDL from '../anchor-idl/wormhole.json' assert { type: 'json' };

export function createWormholeProgramInterface(
  programId: PublicKeyInitData,
  provider?: Provider,
): Program<Wormhole> {
  return new Program<Wormhole>(
    IDL as Wormhole,
    new PublicKey(programId),
    provider === undefined ? ({ connection: null } as any) : provider,
    coder(),
  );
}

export function createReadOnlyWormholeProgramInterface(
  programId: PublicKeyInitData,
  connection?: Connection,
): Program<Wormhole> {
  return createWormholeProgramInterface(
    programId,
    utils.createReadOnlyProvider(connection),
  );
}

export function coder(): WormholeCoder {
  return new WormholeCoder(IDL as Wormhole);
}
