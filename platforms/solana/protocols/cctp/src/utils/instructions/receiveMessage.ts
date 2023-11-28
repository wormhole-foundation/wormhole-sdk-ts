import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  AccountMeta,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
} from '@solana/web3.js';
import { CircleTransferMessage } from '@wormhole-foundation/connect-sdk';
import { findProgramAddress } from '../accounts';
import { createMessageTransmitterProgramInterface } from '../program';

const CCTP_NONCE_OFFSET = 12;

export function createReceiveMessageInstruction(
  messageTransmitterProgramId: PublicKey,
  tokenMessengerProgramId: PublicKey,
  message: CircleTransferMessage,
  payer?: PublicKeyInitData,
) {
  const messageBytes = Buffer.from(
    message.messageId.message.replace('0x', ''),
    'hex',
  );

  const attestationBytes = Buffer.from(
    message.attestation.replace('0x', ''),
    'hex',
  );
  const nonce = ;

  const remoteDomain = getDomainCCTP(message.fromChain);
  const tokenKey = getNativeVersionOfToken('USDC', 'solana');
  const tokenConfig = TOKENS[tokenKey];
  if (!tokenConfig || !tokenConfig.tokenId)
    throw new Error('Invalid USDC token');

  const solanaUsdcAddress = new PublicKey(tokenConfig.tokenId.address);
  const sourceUsdcAddress = new PublicKey(message.token.address.toString());

  const payerPubkey = payer
    ? new PublicKey(payer)
    : message.to.address.unwrap();

  const userTokenAccount = await getAssociatedTokenAddress(
    solanaUsdcAddress,
    new PublicKey(message.recipient),
  );

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
    [solanaUsdcAddress],
  );
  const remoteTokenMessengerKey = findProgramAddress(
    'remote_token_messenger',
    tokenMessengerProgramId,
    [remoteDomain.toString()],
  );
  const tokenPair = findProgramAddress('token_pair', tokenMessengerProgramId, [
    remoteDomain.toString(),
    sourceUsdcAddress,
  ]);
  const custodyTokenAccount = findProgramAddress(
    'custody',
    tokenMessengerProgramId,
    [solanaUsdcAddress],
  );
  const authorityPda = findProgramAddress(
    'message_transmitter_authority',
    messageTransmitterProgramId,
  ).publicKey;

  // Calculate the nonce PDA.
  const maxNoncesPerAccount = 6400;
  const firstNonce =
    ((nonce - BigInt(1)) / BigInt(maxNoncesPerAccount)) *
      BigInt(maxNoncesPerAccount) +
    BigInt(1);
  const usedNonces = findProgramAddress(
    'used_nonces',
    messageTransmitterProgramId,
    [remoteDomain.toString(), firstNonce.toString()],
  ).publicKey;

  // Build the accountMetas list. These are passed as remainingAccounts for the TokenMessengerMinter CPI
  const accountMetas: AccountMeta[] = [];
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessenger.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: remoteTokenMessengerKey.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: tokenMinter.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: localToken.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenPair.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: userTokenAccount,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: custodyTokenAccount.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: TOKEN_PROGRAM_ID,
  });

  const messageTransmitterProgram = createMessageTransmitterProgramInterface(
    messageTransmitterProgramId,
  );

  return (
    messageTransmitterProgram.methods
      .receiveMessage({
        message: messageBytes,
        attestation: attestationBytes,
      })
      .accounts({
        payer: payerPubkey,
        caller: payerPubkey,
        authorityPda,
        messageTransmitter: messageTransmitterAccount.publicKey,
        usedNonces,
        receiver: tokenMessengerProgramId,
        systemProgram: SystemProgram.programId,
      })
      // Add remainingAccounts needed for TokenMessengerMinter CPI
      .remainingAccounts(accountMetas)
      .transaction()
  );
}
