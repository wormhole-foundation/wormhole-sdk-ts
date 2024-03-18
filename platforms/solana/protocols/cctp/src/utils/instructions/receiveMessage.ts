import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { AccountMeta, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import type {
  CircleAttestation,
  circle,
} from '@wormhole-foundation/sdk-connect';
import { CircleBridge, encoding } from '@wormhole-foundation/sdk-connect';
import { SolanaAddress } from '@wormhole-foundation/sdk-solana';
import { createMessageTransmitterProgramInterface } from '../program.js';
import { findProgramAddress } from './../accounts/index.js';

const MAX_NONCES_PER_ACCOUNT = 6400n;

export function calculateFirstNonce(nonce: bigint) {
  return (
    ((nonce - BigInt(1)) / MAX_NONCES_PER_ACCOUNT) * MAX_NONCES_PER_ACCOUNT +
    BigInt(1)
  );
}
export function nonceAccount(
  nonce: bigint,
  sourceChain: circle.CircleChainId,
  messageTransmitterProgramId: PublicKey,
) {
  const srcDomain = sourceChain.toString();
  const usedNonces = findProgramAddress(
    'used_nonces',
    messageTransmitterProgramId,
    [srcDomain, calculateFirstNonce(nonce).toString()],
  ).publicKey;

  return usedNonces;
}

export async function createReceiveMessageInstruction(
  messageTransmitterProgramId: PublicKey,
  tokenMessengerProgramId: PublicKey,
  usdcAddress: PublicKey,
  circleMessage: CircleBridge.Message,
  attestation: CircleAttestation,
  payer?: PublicKeyInitData,
) {
  const messageBytes = Buffer.from(CircleBridge.serialize(circleMessage));
  const attestationBytes = Buffer.from(encoding.hex.decode(attestation));

  const solanaUsdcAddress = new PublicKey(usdcAddress);

  const sourceUsdcAddress = new PublicKey(
    circleMessage.payload.burnToken.toUint8Array(),
  );

  const receiver = new SolanaAddress(
    circleMessage.payload.mintRecipient,
  ).unwrap();

  const payerPubkey = payer ? new PublicKey(payer) : receiver;

  const srcDomain = circleMessage.sourceDomain.toString();

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
    [srcDomain],
  );
  const tokenPair = findProgramAddress('token_pair', tokenMessengerProgramId, [
    srcDomain,
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
    [tokenMessengerProgramId],
  ).publicKey;

  // Calculate the nonce PDA.
  const usedNonces = nonceAccount(
    circleMessage.nonce,
    circleMessage.sourceDomain as circle.CircleChainId,
    messageTransmitterProgramId,
  );

  const eventAuthority = findProgramAddress(
    '__event_authority',
    messageTransmitterProgramId,
  );

  const tokenMessengerEventAuthority = findProgramAddress(
    '__event_authority',
    tokenMessengerProgramId,
  );

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
    pubkey: receiver,
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
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessengerEventAuthority.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessengerProgramId,
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
        eventAuthority: eventAuthority.publicKey,
        program: messageTransmitterProgram.programId,
      })
      // Add remainingAccounts needed for TokenMessengerMinter CPI
      .remainingAccounts(accountMetas)
      .transaction()
  );
}
