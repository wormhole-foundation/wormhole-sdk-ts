import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { Program, Provider } from '@project-serum/anchor';
import { createReadOnlyProvider } from '../utils/index.js';
import { WormholeCoder } from './coder/index.js';
import { Wormhole } from '../types/wormhole.js';
import { anchorIdl } from '@wormhole-foundation/connect-sdk';

export function createWormholeProgramInterface(
  programId: PublicKeyInitData,
  provider?: Provider,
): Program<Wormhole> {
  return new Program<Wormhole>(
    anchorIdl.wormhole as Wormhole,
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
    createReadOnlyProvider(connection),
  );
}

export function coder(): WormholeCoder {
  return new WormholeCoder(anchorIdl.wormhole as Wormhole);
}
