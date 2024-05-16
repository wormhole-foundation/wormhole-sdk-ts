import type { Connection, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import {
  type TokenBridgeRelayer,
  TOKEN_BRIDGE_RELAYER_IDL as IDL,
} from '../../automaticTokenBridgeType.js';

export function createTokenBridgeRelayerProgramInterface(
  programId: PublicKeyInitData,
  connection: Connection,
): Program<TokenBridgeRelayer> {
  return new Program(IDL, new PublicKey(programId), { connection });
}
