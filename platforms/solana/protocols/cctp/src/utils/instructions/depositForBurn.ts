import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { TransactionInstruction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { UniversalAddress } from '@wormhole-foundation/sdk-connect';
import BN from 'bn.js';
import { createTokenMessengerProgramInterface } from '../program.js';
import { findProgramAddress } from './../accounts/index.js';

export function createDepositForBurnInstruction(
  messageTransmitterProgramId: PublicKey,
  tokenMessengerProgramId: PublicKey,
  tokenMint: PublicKey,
  destinationDomain: number,
  senderAddress: PublicKey,
  senderAssociatedTokenAccountAddress: PublicKey,
  recipient: UniversalAddress,
  amount: bigint,
  messageSendEventData: PublicKey,
): Promise<TransactionInstruction> {
  // Find pdas
  const messageTransmitterAccount = findProgramAddress(
    'message_transmitter',
    messageTransmitterProgramId,
  );
  const tokenMessenger = findProgramAddress(
    'token_messenger',
    tokenMessengerProgramId,
  );
  const tokenMinter = findProgramAddress(
    'token_minter',
    tokenMessengerProgramId,
  );
  const localToken = findProgramAddress(
    'local_token',
    tokenMessengerProgramId,
    [tokenMint],
  );
  const remoteTokenMessengerKey = findProgramAddress(
    'remote_token_messenger',
    tokenMessengerProgramId,
    [destinationDomain.toString()],
  );
  const authorityPda = findProgramAddress(
    'sender_authority',
    tokenMessengerProgramId,
  );

  const tokenMessengerProgram = createTokenMessengerProgramInterface(
    tokenMessengerProgramId,
  );

  const eventAuthority = findProgramAddress(
    '__event_authority',
    tokenMessengerProgramId,
  );

  return tokenMessengerProgram.methods
    .depositForBurn({
      amount: new BN(amount.toString()),
      destinationDomain,
      mintRecipient: new PublicKey(recipient.toUint8Array()),
    })
    .accounts({
      owner: senderAddress,
      senderAuthorityPda: authorityPda.publicKey,
      burnTokenAccount: senderAssociatedTokenAccountAddress,
      messageTransmitter: messageTransmitterAccount.publicKey,
      tokenMessenger: tokenMessenger.publicKey,
      remoteTokenMessenger: remoteTokenMessengerKey.publicKey,
      tokenMinter: tokenMinter.publicKey,
      localToken: localToken.publicKey,
      burnTokenMint: tokenMint,
      messageTransmitterProgram: messageTransmitterProgramId,
      tokenMessengerMinterProgram: tokenMessengerProgramId,
      tokenProgram: TOKEN_PROGRAM_ID,
      eventAuthority: eventAuthority.publicKey,
      eventRentPayer: senderAddress,
      messageSentEventData: messageSendEventData,
    })
    .instruction();
}
