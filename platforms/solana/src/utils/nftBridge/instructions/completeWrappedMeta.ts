import {
  Connection,
  PublicKey,
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import { createReadOnlyNftBridgeProgramInterface } from '../program';
import { VAA } from '@wormhole-foundation/connect-sdk';

export function createCompleteWrappedMetaInstruction(
  connection: Connection,
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA,
): TransactionInstruction {
  const methods =
    createReadOnlyNftBridgeProgramInterface(
      nftBridgeProgramId,
    ).methods.completeWrappedMeta();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getCompleteWrappedMetaAccounts(
      nftBridgeProgramId,
      wormholeProgramId,
      payer,
      vaa,
    ) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface CompleteWrappedMetaAccounts {
  payer: PublicKey;
  config: PublicKey;
  vaa: PublicKey;
  endpoint: PublicKey;
  mint: PublicKey;
  wrappedMeta: PublicKey;
  splMetadata: PublicKey;
  mintAuthority: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  splMetadataProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getCompleteWrappedMetaAccounts(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA,
): CompleteWrappedMetaAccounts {
  throw new Error('Not implemented');
  // const mint = deriveWrappedMintKey(
  //   nftBridgeProgramId,
  //   parsed.tokenChain,
  //   parsed.tokenAddress,
  //   parsed.tokenId,
  // );
  // return {
  //   payer: new PublicKey(payer),
  //   config: deriveNftBridgeConfigKey(nftBridgeProgramId),
  //   vaa: derivePostedVaaKey(wormholeProgramId, parsed.hash),
  //   endpoint: deriveEndpointKey(
  //     nftBridgeProgramId,
  //     parsed.emitterChain,
  //     parsed.emitterAddress,
  //   ),
  //   mint,
  //   wrappedMeta: deriveWrappedMetaKey(nftBridgeProgramId, mint),
  //   splMetadata: deriveSplTokenMetadataKey(mint),
  //   mintAuthority: deriveMintAuthorityKey(nftBridgeProgramId),
  //   rent: SYSVAR_RENT_PUBKEY,
  //   systemProgram: SystemProgram.programId,
  //   tokenProgram: TOKEN_PROGRAM_ID,
  //   splMetadataProgram: SplTokenMetadataProgram.programId,
  //   wormholeProgram: new PublicKey(wormholeProgramId),
  // };
}
