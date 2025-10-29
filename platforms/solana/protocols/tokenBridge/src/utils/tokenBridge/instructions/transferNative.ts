import type {
  Connection,
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { createReadOnlyTokenBridgeProgramInterface } from '../program.js';
import { utils } from '@wormhole-foundation/sdk-solana-core';
import {
  deriveAuthoritySignerKey,
  deriveCustodySignerKey,
  deriveTokenBridgeConfigKey,
  deriveCustodyKey,
} from './../accounts/index.js';

export function createTransferNativeInstruction(
  connection: Connection,
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  message: PublicKeyInitData,
  from: PublicKeyInitData,
  mint: PublicKeyInitData,
  tokenProgram: PublicKeyInitData,
  nonce: number,
  amount: bigint,
  fee: bigint,
  targetAddress: Buffer | Uint8Array,
  targetChain: number,
): TransactionInstruction {
  const methods = createReadOnlyTokenBridgeProgramInterface(
    tokenBridgeProgramId,
    connection,
  ).methods.transferNative(
    nonce,
    amount as any,
    fee as any,
    Buffer.from(targetAddress) as any,
    targetChain,
  );

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getTransferNativeAccounts(
      tokenBridgeProgramId,
      wormholeProgramId,
      payer,
      message,
      from,
      mint,
      tokenProgram,
    ) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface TransferNativeAccounts {
  payer: PublicKey;
  config: PublicKey;
  from: PublicKey;
  mint: PublicKey;
  custody: PublicKey;
  authoritySigner: PublicKey;
  custodySigner: PublicKey;
  wormholeBridge: PublicKey;
  wormholeMessage: PublicKey;
  wormholeEmitter: PublicKey;
  wormholeSequence: PublicKey;
  wormholeFeeCollector: PublicKey;
  clock: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getTransferNativeAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  message: PublicKeyInitData,
  from: PublicKeyInitData,
  mint: PublicKeyInitData,
  tokenProgram: PublicKeyInitData,
): TransferNativeAccounts {
  const {
    wormholeBridge,
    wormholeMessage,
    wormholeEmitter,
    wormholeSequence,
    wormholeFeeCollector,
    clock,
    rent,
    systemProgram,
  } = utils.getPostMessageCpiAccounts(
    tokenBridgeProgramId,
    wormholeProgramId,
    payer,
    message,
  );
  return {
    payer: new PublicKey(payer),
    config: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    from: new PublicKey(from),
    mint: new PublicKey(mint),
    custody: deriveCustodyKey(tokenBridgeProgramId, mint),
    authoritySigner: deriveAuthoritySignerKey(tokenBridgeProgramId),
    custodySigner: deriveCustodySignerKey(tokenBridgeProgramId),
    wormholeBridge,
    wormholeMessage: wormholeMessage,
    wormholeEmitter,
    wormholeSequence,
    wormholeFeeCollector,
    clock,
    rent,
    systemProgram,
    tokenProgram: new PublicKey(tokenProgram),
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}
