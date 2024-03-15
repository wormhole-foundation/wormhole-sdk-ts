import type { Connection, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import type { TokenBridgeRelayer } from '../../automaticTokenBridgeType.js';
import { IDL } from '../../automaticTokenBridgeType.js';

export function createTokenBridgeRelayerProgramInterface(
  programId: PublicKeyInitData,
  connection: Connection,
): Program<TokenBridgeRelayer> {
  return new Program(IDL, new PublicKey(programId), { connection });
}
