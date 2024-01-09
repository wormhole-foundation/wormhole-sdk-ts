import { utils } from '@wormhole-foundation/connect-sdk-solana';
import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { Chain, toChainId } from '@wormhole-foundation/connect-sdk';

export interface ForeignContract {
  chain: number;
  address: number[];
  fee: BN;
}

export function deriveForeignContractAddress(
  programId: PublicKeyInitData,
  chainId: Chain,
): PublicKey {
  const chainIdBuf = Buffer.alloc(2);
  chainIdBuf.writeUInt16BE(toChainId(chainId));
  return utils.deriveAddress(
    [Buffer.from('foreign_contract'), chainIdBuf],
    programId,
  );
}
