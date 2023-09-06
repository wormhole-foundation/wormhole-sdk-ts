import {
  Connection,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createReadOnlyTokenBridgeProgramInterface } from '../program';
import { deriveClaimKey, derivePostedVaaKey } from '../../wormhole';
import {
  deriveEndpointKey,
  deriveMintAuthorityKey,
  deriveSplTokenMetadataKey,
  deriveWrappedMetaKey,
  deriveTokenBridgeConfigKey,
  deriveWrappedMintKey,
} from '../accounts';
import { SplTokenMetadataProgram } from '../../utils';
import { toChainId, VAA } from '@wormhole-foundation/connect-sdk';

export function createCreateWrappedInstruction(
  connection: Connection,
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'AttestMeta'>,
): TransactionInstruction {
  const methods = createReadOnlyTokenBridgeProgramInterface(
    tokenBridgeProgramId,
    connection,
  ).methods.createWrapped();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getCreateWrappedAccounts(
      tokenBridgeProgramId,
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

export interface CreateWrappedAccounts {
  payer: PublicKey;
  config: PublicKey;
  endpoint: PublicKey;
  vaa: PublicKey;
  claim: PublicKey;
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

export function getCreateWrappedAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'AttestMeta'>,
): CreateWrappedAccounts {
  const mint = deriveWrappedMintKey(
    tokenBridgeProgramId,
    toChainId(vaa.payload.token.chain),
    vaa.payload.token.address.toUint8Array(),
  );
  return {
    payer: new PublicKey(payer),
    config: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    endpoint: deriveEndpointKey(
      tokenBridgeProgramId,
      toChainId(vaa.emitterChain),
      vaa.emitterAddress.toUint8Array(),
    ),
    vaa: derivePostedVaaKey(wormholeProgramId, Buffer.from(vaa.hash)),
    claim: deriveClaimKey(
      tokenBridgeProgramId,
      vaa.emitterAddress.toUint8Array(),
      toChainId(vaa.emitterChain),
      vaa.sequence,
    ),
    mint,
    wrappedMeta: deriveWrappedMetaKey(tokenBridgeProgramId, mint),
    splMetadata: deriveSplTokenMetadataKey(mint),
    mintAuthority: deriveMintAuthorityKey(tokenBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    splMetadataProgram: SplTokenMetadataProgram.programId,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}
