import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  createCompleteTransferNativeInstruction,
  createCompleteTransferWrappedInstruction,
} from './tokenBridge';
import {
  ACCOUNT_SIZE,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  createTransferInstruction,
  getMinimumBalanceForRentExemptAccount,
  getMint,
} from '@solana/spl-token';
import { UniversalAddress, VAA } from '@wormhole-foundation/sdk-definitions';

// TODO:
const MAX_VAA_DECIMALS = 8;

export async function redeemOnSolana(
  connection: Connection,
  bridgeAddress: PublicKeyInitData,
  tokenBridgeAddress: PublicKeyInitData,
  payerAddress: PublicKeyInitData,
  vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  feeRecipientAddress?: PublicKeyInitData,
  commitment?: Commitment,
) {
  const createCompleteTransferInstruction =
    vaa.payload.token.chain == 'Solana'
      ? createCompleteTransferNativeInstruction
      : createCompleteTransferWrappedInstruction;
  const transaction = new Transaction().add(
    createCompleteTransferInstruction(
      connection,
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      vaa,
      feeRecipientAddress,
    ),
  );
  const { blockhash } = await connection.getLatestBlockhash(commitment);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}

export async function redeemAndUnwrapOnSolana(
  connection: Connection,
  bridgeAddress: PublicKeyInitData,
  tokenBridgeAddress: PublicKeyInitData,
  payerAddress: PublicKeyInitData,
  vaa: VAA<'Transfer'>,
  commitment?: Commitment,
) {
  const targetPublicKey = new PublicKey(vaa.payload.to);
  const targetAmount = await getMint(connection, NATIVE_MINT, commitment).then(
    (info) =>
      vaa.payload.token.amount *
      BigInt(Math.pow(10, info.decimals - MAX_VAA_DECIMALS)),
  );
  const rentBalance = await getMinimumBalanceForRentExemptAccount(
    connection,
    commitment,
  );

  // TODO: native compare
  const nativeMint = new UniversalAddress(NATIVE_MINT.toBytes());
  if (!vaa.payload.token.address.equals(nativeMint)) {
    return Promise.reject('tokenAddress != NATIVE_MINT');
  }
  const payerPublicKey = new PublicKey(payerAddress);
  const ancillaryKeypair = Keypair.generate();

  const completeTransferIx = createCompleteTransferNativeInstruction(
    connection,
    tokenBridgeAddress,
    bridgeAddress,
    payerPublicKey,
    vaa,
  );

  //This will create a temporary account where the wSOL will be moved
  const createAncillaryAccountIx = SystemProgram.createAccount({
    fromPubkey: payerPublicKey,
    newAccountPubkey: ancillaryKeypair.publicKey,
    lamports: rentBalance, //spl token accounts need rent exemption
    space: ACCOUNT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });

  //Initialize the account as a WSOL account, with the original payerAddress as owner
  const initAccountIx = createInitializeAccountInstruction(
    ancillaryKeypair.publicKey,
    NATIVE_MINT,
    payerPublicKey,
  );

  //Send in the amount of wSOL which we want converted to SOL
  const balanceTransferIx = createTransferInstruction(
    targetPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey,
    targetAmount.valueOf(),
  );

  //Close the ancillary account for cleanup. Payer address receives any remaining funds
  const closeAccountIx = createCloseAccountInstruction(
    ancillaryKeypair.publicKey, //account to close
    payerPublicKey, //Remaining funds destination
    payerPublicKey, //authority
  );

  const { blockhash } = await connection.getLatestBlockhash(commitment);
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPublicKey;
  transaction.add(
    completeTransferIx,
    createAncillaryAccountIx,
    initAccountIx,
    balanceTransferIx,
    closeAccountIx,
  );
  transaction.partialSign(ancillaryKeypair);
  return transaction;
}
