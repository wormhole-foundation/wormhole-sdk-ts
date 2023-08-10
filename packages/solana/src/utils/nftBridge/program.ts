import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { BN, Program, Provider } from '@project-serum/anchor';
import { createReadOnlyProvider } from '../utils/index.js';
import { NftBridgeCoder } from './coder/index.js';
import { NftBridge } from '../types/nftBridge.js';
import { anchorIdl } from '@wormhole-foundation/connect-sdk';

export const NFT_TRANSFER_NATIVE_TOKEN_ADDRESS = Buffer.alloc(32, 1);

export function createNftBridgeProgramInterface(
  programId: PublicKeyInitData,
  provider?: Provider,
): Program<NftBridge> {
  return new Program<NftBridge>(
    anchorIdl.nft_bridge as NftBridge,
    new PublicKey(programId),
    provider === undefined ? ({ connection: null } as any) : provider,
    coder(),
  );
}

export function createReadOnlyNftBridgeProgramInterface(
  programId: PublicKeyInitData,
  connection?: Connection,
): Program<NftBridge> {
  return createNftBridgeProgramInterface(
    programId,
    createReadOnlyProvider(connection),
  );
}

export function coder(): NftBridgeCoder {
  return new NftBridgeCoder(anchorIdl.nft_bridge as NftBridge);
}

export function tokenIdToMint(tokenId: bigint) {
  return new PublicKey(new BN(tokenId.toString()).toArrayLike(Buffer));
}

export function mintToTokenId(mint: PublicKeyInitData) {
  return BigInt(new BN(new PublicKey(mint).toBuffer()).toString());
}
