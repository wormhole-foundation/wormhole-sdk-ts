import type {
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import type { VAA } from '@wormhole-foundation/sdk-connect';
import { toChainId } from '@wormhole-foundation/sdk-connect';
import { utils } from '@wormhole-foundation/sdk-solana';
import { utils as CoreUtils } from '@wormhole-foundation/sdk-solana-core';
import {
  deriveEndpointKey,
  deriveTokenBridgeConfigKey,
} from './../accounts/index.js';
import { createReadOnlyTokenBridgeProgramInterface } from '../program.js';

export function createRegisterChainInstruction(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: VAA<'TokenBridge:RegisterChain'>,
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
  vaa: VAA<'TokenBridge:RegisterChain'>,
): RegisterChainAccounts {
  return {
    payer: new PublicKey(payer),
    config: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    endpoint: deriveEndpointKey(
      tokenBridgeProgramId,
      toChainId(vaa.payload.actionArgs.foreignChain),
      vaa.payload.actionArgs.foreignAddress.toUint8Array(),
    ),
    vaa: CoreUtils.derivePostedVaaKey(wormholeProgramId, Buffer.from(vaa.hash)),
    claim: CoreUtils.deriveClaimKey(
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
  vaa: VAA<'TokenBridge:UpgradeContract'>,
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
  vaa: VAA<'TokenBridge:UpgradeContract'>,
  spill?: PublicKeyInitData,
): UpgradeContractAccounts {
  return {
    payer: new PublicKey(payer),
    vaa: CoreUtils.derivePostedVaaKey(wormholeProgramId, Buffer.from(vaa.hash)),
    claim: CoreUtils.deriveClaimKey(
      tokenBridgeProgramId,
      vaa.emitterAddress.toUint8Array(),
      toChainId(vaa.emitterChain),
      vaa.sequence,
    ),
    upgradeAuthority: CoreUtils.deriveUpgradeAuthorityKey(tokenBridgeProgramId),
    spill: new PublicKey(spill === undefined ? payer : spill),
    implementation: new PublicKey(vaa.payload.actionArgs.newContract),
    programData: utils.deriveProgramDataAddress(tokenBridgeProgramId),
    tokenBridgeProgram: new PublicKey(tokenBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
    bpfLoaderUpgradeable: utils.BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
}
