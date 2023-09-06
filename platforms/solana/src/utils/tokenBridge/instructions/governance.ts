import {
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import { createReadOnlyTokenBridgeProgramInterface } from '../program';
import { deriveClaimKey, derivePostedVaaKey } from '../../wormhole';
import {
  deriveEndpointKey,
  deriveTokenBridgeConfigKey,
  deriveUpgradeAuthorityKey,
} from '../accounts';
import { BpfLoaderUpgradeable, deriveUpgradeableProgramKey } from '../../utils';
import { VAA, toChainId } from '@wormhole-foundation/connect-sdk';

export function createRegisterChainInstruction(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'TokenBridgeRegisterChain'>,
): TransactionInstruction {
  const methods =
    createReadOnlyTokenBridgeProgramInterface(
      tokenBridgeProgramId,
    ).methods.registerChain();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getRegisterChainAccounts(
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

export interface RegisterChainAccounts {
  payer: PublicKey;
  config: PublicKey;
  endpoint: PublicKey;
  vaa: PublicKey;
  claim: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getRegisterChainAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'TokenBridgeRegisterChain'>,
): RegisterChainAccounts {
  return {
    payer: new PublicKey(payer),
    config: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    endpoint: deriveEndpointKey(
      tokenBridgeProgramId,
      toChainId(vaa.payload.foreignChain),
      vaa.payload.foreignAddress.toUint8Array(),
    ),
    vaa: derivePostedVaaKey(wormholeProgramId, Buffer.from(vaa.hash)),
    claim: deriveClaimKey(
      tokenBridgeProgramId,
      vaa.emitterAddress.toUint8Array(),
      toChainId(vaa.emitterChain),
      vaa.sequence,
    ),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}

export function createUpgradeContractInstruction(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'TokenBridgeUpgradeContract'>,
  spill?: PublicKeyInitData,
): TransactionInstruction {
  const methods =
    createReadOnlyTokenBridgeProgramInterface(
      tokenBridgeProgramId,
    ).methods.upgradeContract();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getUpgradeContractAccounts(
      tokenBridgeProgramId,
      wormholeProgramId,
      payer,
      vaa,
      spill,
    ) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface UpgradeContractAccounts {
  payer: PublicKey;
  vaa: PublicKey;
  claim: PublicKey;
  upgradeAuthority: PublicKey;
  spill: PublicKey;
  implementation: PublicKey;
  programData: PublicKey;
  tokenBridgeProgram: PublicKey;
  rent: PublicKey;
  clock: PublicKey;
  bpfLoaderUpgradeable: PublicKey;
  systemProgram: PublicKey;
}

export function getUpgradeContractAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'TokenBridgeUpgradeContract'>,
  spill?: PublicKeyInitData,
): UpgradeContractAccounts {
  return {
    payer: new PublicKey(payer),
    vaa: derivePostedVaaKey(wormholeProgramId, Buffer.from(vaa.hash)),
    claim: deriveClaimKey(
      tokenBridgeProgramId,
      vaa.emitterAddress.toUint8Array(),
      toChainId(vaa.emitterChain),
      vaa.sequence,
    ),
    upgradeAuthority: deriveUpgradeAuthorityKey(tokenBridgeProgramId),
    spill: new PublicKey(spill === undefined ? payer : spill),
    implementation: new PublicKey(vaa.payload.newContract),
    programData: deriveUpgradeableProgramKey(tokenBridgeProgramId),
    tokenBridgeProgram: new PublicKey(tokenBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
    bpfLoaderUpgradeable: BpfLoaderUpgradeable.programId,
    systemProgram: SystemProgram.programId,
  };
}
