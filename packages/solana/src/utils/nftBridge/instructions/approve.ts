import { PublicKeyInitData } from '@solana/web3.js';
import { createApproveAuthoritySignerInstruction as _createApproveAuthoritySignerInstruction } from '../../tokenBridge/index.js';

export function createApproveAuthoritySignerInstruction(
  nftBridgeProgramId: PublicKeyInitData,
  tokenAccount: PublicKeyInitData,
  owner: PublicKeyInitData,
) {
  return _createApproveAuthoritySignerInstruction(
    nftBridgeProgramId,
    tokenAccount,
    owner,
    1,
  );
}
