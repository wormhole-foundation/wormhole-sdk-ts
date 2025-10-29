import type {
  Connection,
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createReadOnlyTokenBridgeProgramInterface } from '../program.js';
import { utils } from '@wormhole-foundation/sdk-solana-core';
import {
  deriveAuthoritySignerKey,
  deriveCustodySignerKey,
  deriveTokenBridgeConfigKey,
  deriveCustodyKey,
  deriveSenderAccountKey,
} from './../accounts/index.js';

export function createTransferNativeWithPayloadInstruction(
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
  targetAddress: Buffer | Uint8Array,
  targetChain: number,
  payload: Buffer | Uint8Array,
): TransactionInstruction {
  const methods = createReadOnlyTokenBridgeProgramInterface(
    tokenBridgeProgramId,
    connection,
  ).methods.transferNativeWithPayload(
    nonce,
    amount as any,
    Buffer.from(targetAddress) as any,
    targetChain,
    Buffer.from(payload) as any,
    null,
  );

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getTransferNativeWithPayloadAccounts(
      tokenBridgeProgramId,
      wormholeProgramId,
      payer,
      message,
      from,
      mint,
      undefined,
      tokenProgram,
    ) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface TransferNativeWithPayloadAccounts {
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
  sender: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getTransferNativeWithPayloadAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  message: PublicKeyInitData,
  from: PublicKeyInitData,
  mint: PublicKeyInitData,
  cpiProgramId?: PublicKeyInitData,
  tokenProgramId?: PublicKeyInitData,
): TransferNativeWithPayloadAccounts {
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
    sender: new PublicKey(
      cpiProgramId === undefined ? payer : deriveSenderAccountKey(cpiProgramId),
    ),
    rent,
    systemProgram,
    tokenProgram: tokenProgramId
      ? new PublicKey(tokenProgramId)
      : TOKEN_PROGRAM_ID,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}
