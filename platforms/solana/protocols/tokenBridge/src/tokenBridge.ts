import type {
  Chain,
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  Platform,
  TokenBridge,
  TokenId,
} from '@wormhole-foundation/sdk-connect';
import {
  ErrNotWrapped,
  UniversalAddress,
  encoding,
  isNative,
  toChain,
  toChainId,
  toNative,
} from '@wormhole-foundation/sdk-connect';
import type {
  AnySolanaAddress,
  SolanaChains,
  SolanaTransaction,
} from '@wormhole-foundation/sdk-solana';
import {
  SolanaAddress,
  SolanaPlatform,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
import {
  SolanaWormholeCore,
  utils as coreUtils,
} from '@wormhole-foundation/sdk-solana-core';

import type { Program } from '@coral-xyz/anchor';
import {
  ACCOUNT_SIZE,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptAccount,
  getMint,
} from '@solana/spl-token';
import type { Connection, TransactionInstruction } from '@solana/web3.js';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import type { TokenBridge as TokenBridgeContract } from './tokenBridgeType.js';
import {
  createApproveAuthoritySignerInstruction,
  createAttestTokenInstruction,
  createCompleteTransferNativeInstruction,
  createCompleteTransferWrappedInstruction,
  createCreateWrappedInstruction,
  createReadOnlyTokenBridgeProgramInterface,
  createTransferNativeInstruction,
  createTransferNativeWithPayloadInstruction,
  createTransferWrappedInstruction,
  createTransferWrappedWithPayloadInstruction,
  deriveWrappedMintKey,
  getWrappedMeta,
} from './utils/index.js';

import '@wormhole-foundation/sdk-solana-core';

export class SolanaTokenBridge<N extends Network, C extends SolanaChains>
  implements TokenBridge<N, C>
{
  readonly chainId: ChainId;

  readonly coreBridge: SolanaWormholeCore<N, C>;
  readonly tokenBridge: Program<TokenBridgeContract>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    const tokenBridgeAddress = contracts.tokenBridge;
    if (!tokenBridgeAddress)
      throw new Error(
        `TokenBridge contract Address for chain ${chain} not found`,
      );

    this.tokenBridge = createReadOnlyTokenBridgeProgramInterface(
      tokenBridgeAddress,
      connection,
    );

    this.coreBridge = new SolanaWormholeCore(
      network,
      chain,
      connection,
      contracts,
    );
  }

  static async fromRpc<N extends Network>(
    connection: Connection,
    config: ChainsConfig<N, Platform>,
  ): Promise<SolanaTokenBridge<N, SolanaChains>> {
    const [network, chain] = await SolanaPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(
        `Network mismatch for chain ${chain}: ${conf.network} != ${network}`,
      );

    return new SolanaTokenBridge(
      network as N,
      chain,
      connection,
      conf.contracts,
    );
  }

  async isWrappedAsset(token: AnySolanaAddress): Promise<boolean> {
    return getWrappedMeta(
      this.connection,
      this.tokenBridge.programId,
      new SolanaAddress(token).toUint8Array(),
    )
      .catch((_) => null)
      .then((meta) => meta != null);
  }

  async getOriginalAsset(token: AnySolanaAddress): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token)))
      throw ErrNotWrapped(token.toString());

    const tokenAddr = new SolanaAddress(token).toUint8Array();
    const mint = new PublicKey(tokenAddr);

    try {
      const meta = await getWrappedMeta(
        this.connection,
        this.tokenBridge.programId,
        tokenAddr,
      );

      if (meta === null)
        return {
          chain: this.chain,
          address: new SolanaAddress(mint.toBytes()).toUniversalAddress(),
        };

      return {
        chain: toChain(meta.chain as ChainId),
        address: new UniversalAddress(new Uint8Array(meta.tokenAddress)),
      };
    } catch (_) {
      throw ErrNotWrapped(token.toString());
    }
  }

  async getTokenUniversalAddress(
    token: NativeAddress<C>,
  ): Promise<UniversalAddress> {
    return new SolanaAddress(token).toUniversalAddress();
  }

  async getTokenNativeAddress(
    originChain: Chain,
    token: UniversalAddress,
  ): Promise<NativeAddress<C>> {
    return new SolanaAddress(token).toNative() as NativeAddress<C>;
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (_) {}
    return false;
  }

  async getWrappedAsset(token: TokenId) {
    if (isNative(token.address))
      throw new Error('Native cannot be a wrapped asset');

    const mint = deriveWrappedMintKey(
      this.tokenBridge.programId,
      toChainId(token.chain),
      token.address.toUniversalAddress().toUint8Array(),
    );

    // If we don't throw an error getting wrapped meta, we're good to return
    // the derived mint address back to the caller.
    try {
      await getWrappedMeta(this.connection, this.tokenBridge.programId, mint);
      return toNative(this.chain, mint.toBase58());
    } catch (_) {}

    throw ErrNotWrapped(
      `${mint}: ${token.address.toUniversalAddress().toString()}`,
    );
  }

  async isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    return coreUtils
      .getClaim(
        this.connection,
        this.tokenBridge.programId,
        vaa.emitterAddress.toUint8Array(),
        toChainId(vaa.emitterChain),
        vaa.sequence,
        this.connection.commitment,
      )
      .catch(() => false);
  }

  async getWrappedNative() {
    return toNative(this.chain, NATIVE_MINT.toBase58());
  }

  async *createAttestation(
    token: AnySolanaAddress,
    payer?: AnySolanaAddress,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    if (!payer) throw new Error('Payer required to create attestation');

    const senderAddress = new SolanaAddress(payer).unwrap();
    // TODO: createNonce().readUInt32LE(0);
    const nonce = 0;

    const msgFee = await this.coreBridge.getMessageFee();
    const transferIx = coreUtils.createBridgeFeeTransferInstruction(
      this.coreBridge.coreBridge.programId,
      senderAddress,
      msgFee,
    );

    const messageKey = Keypair.generate();
    const attestIx = createAttestTokenInstruction(
      this.connection,
      this.tokenBridge.programId,
      this.coreBridge.address,
      senderAddress,
      new SolanaAddress(token).unwrap(),
      messageKey.publicKey,
      nonce,
    );

    const transaction = new Transaction().add(transferIx, attestIx);
    transaction.feePayer = senderAddress;
    yield this.createUnsignedTx(
      { transaction, signers: [messageKey] },
      'Solana.AttestToken',
    );
  }

  async *submitAttestation(
    vaa: TokenBridge.AttestVAA,
    payer?: AnySolanaAddress,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    if (!payer) throw new Error('Payer required to create attestation');

    const senderAddress = new SolanaAddress(payer).unwrap();

    // Yield transactions to verify sigs and post the VAA
    yield* this.coreBridge.postVaa(senderAddress, vaa);

    // Now yield the transaction to actually create the token
    const transaction = new Transaction().add(
      createCreateWrappedInstruction(
        this.connection,
        this.tokenBridge.programId,
        this.coreBridge.address,
        senderAddress,
        vaa,
      ),
    );
    transaction.feePayer = senderAddress;

    yield this.createUnsignedTx({ transaction }, 'Solana.CreateWrapped');
  }

  private async transferSol(
    sender: AnySolanaAddress,
    recipient: ChainAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): Promise<SolanaUnsignedTransaction<N, C>> {
    //  https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/solana/context.ts#L245

    const senderAddress = new SolanaAddress(sender).unwrap();

    // TODO: the payer can actually be different from the sender. We need to allow the user to pass in an optional payer
    const payerPublicKey = senderAddress;

    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
    const recipientChainId = toChainId(recipient.chain);

    const nonce = 0;
    const relayerFee = 0n;

    const message = Keypair.generate();
    const ancillaryKeypair = Keypair.generate();

    const rentBalance = await getMinimumBalanceForRentExemptAccount(
      this.connection,
    );

    //This will create a temporary account where the wSOL will be created.
    const createAncillaryAccountIx = SystemProgram.createAccount({
      fromPubkey: payerPublicKey,
      newAccountPubkey: ancillaryKeypair.publicKey,
      lamports: rentBalance, //spl token accounts need rent exemption
      space: ACCOUNT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });

    //Send in the amount of SOL which we want converted to wSOL
    const initialBalanceTransferIx = SystemProgram.transfer({
      fromPubkey: payerPublicKey,
      lamports: amount,
      toPubkey: ancillaryKeypair.publicKey,
    });

    //Initialize the account as a WSOL account, with the original payerAddress as owner
    const initAccountIx = createInitializeAccountInstruction(
      ancillaryKeypair.publicKey,
      NATIVE_MINT,
      payerPublicKey,
    );

    //Normal approve & transfer instructions, except that the wSOL is sent from the ancillary account.
    const approvalIx = createApproveAuthoritySignerInstruction(
      this.tokenBridge.programId,
      ancillaryKeypair.publicKey,
      payerPublicKey,
      amount,
    );

    const tokenBridgeTransferIx = payload
      ? createTransferNativeWithPayloadInstruction(
          this.connection,
          this.tokenBridge.programId,
          this.coreBridge.address,
          senderAddress,
          message.publicKey,
          ancillaryKeypair.publicKey,
          NATIVE_MINT,
          nonce,
          amount,
          recipientAddress,
          recipientChainId,
          payload,
        )
      : createTransferNativeInstruction(
          this.connection,
          this.tokenBridge.programId,
          this.coreBridge.address,
          senderAddress,
          message.publicKey,
          ancillaryKeypair.publicKey,
          NATIVE_MINT,
          nonce,
          amount,
          relayerFee,
          recipientAddress,
          recipientChainId,
        );

    //Close the ancillary account for cleanup. Payer address receives any remaining funds
    const closeAccountIx = createCloseAccountInstruction(
      ancillaryKeypair.publicKey, //account to close
      payerPublicKey, //Remaining funds destination
      payerPublicKey, //authority
    );

    const transaction = new Transaction();
    transaction.feePayer = payerPublicKey;
    transaction.add(
      createAncillaryAccountIx,
      initialBalanceTransferIx,
      initAccountIx,
      approvalIx,
      tokenBridgeTransferIx,
      closeAccountIx,
    );
    return this.createUnsignedTx(
      { transaction, signers: [message, ancillaryKeypair] },
      'TokenBridge.TransferNative',
    );
  }

  async *transfer(
    sender: AnySolanaAddress,
    recipient: ChainAddress,
    token: AnySolanaAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    // TODO: payer vs sender?? can caller add diff payer later?

    if (isNative(token)) {
      yield await this.transferSol(sender, recipient, amount, payload);
      return;
    }

    const tokenAddress = new SolanaAddress(token).unwrap();
    const senderAddress = new SolanaAddress(sender).unwrap();
    const senderTokenAddress = await getAssociatedTokenAddress(
      tokenAddress,
      senderAddress,
    );

    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
    const recipientChainId = toChainId(recipient.chain);

    const nonce = 0;
    const relayerFee = 0n;

    const isSolanaNative = !(await this.isWrappedAsset(token));

    const message = Keypair.generate();
    let tokenBridgeTransferIx: TransactionInstruction;
    if (isSolanaNative) {
      tokenBridgeTransferIx = payload
        ? createTransferNativeWithPayloadInstruction(
            this.connection,
            this.tokenBridge.programId,
            this.coreBridge.address,
            senderAddress,
            message.publicKey,
            senderTokenAddress,
            tokenAddress,
            nonce,
            amount,
            recipientAddress,
            recipientChainId,
            payload,
          )
        : createTransferNativeInstruction(
            this.connection,
            this.tokenBridge.programId,
            this.coreBridge.address,
            senderAddress,
            message.publicKey,
            senderTokenAddress,
            tokenAddress,
            nonce,
            amount,
            relayerFee,
            recipientAddress,
            recipientChainId,
          );
    } else {
      const originAsset = await this.getOriginalAsset(token);
      if (isNative(originAsset.address))
        throw new Error('Native cannot be an original asset');

      tokenBridgeTransferIx = payload
        ? createTransferWrappedWithPayloadInstruction(
            this.connection,
            this.tokenBridge.programId,
            this.coreBridge.address,
            senderAddress,
            message.publicKey,
            senderTokenAddress,
            senderAddress,
            toChainId(originAsset.chain),
            originAsset.address.toUint8Array(),
            nonce,
            amount,
            recipientAddress,
            recipientChainId,
            payload,
          )
        : createTransferWrappedInstruction(
            this.connection,
            this.tokenBridge.programId,
            this.coreBridge.address,
            senderAddress,
            message.publicKey,
            senderTokenAddress,
            senderAddress,
            toChainId(originAsset.chain),
            originAsset.address.toUint8Array(),
            nonce,
            amount,
            relayerFee,
            recipientAddress,
            recipientChainId,
          );
    }

    const approvalIx = createApproveAuthoritySignerInstruction(
      this.tokenBridge.programId,
      senderTokenAddress,
      senderAddress,
      amount,
    );

    const transaction = new Transaction().add(
      approvalIx,
      tokenBridgeTransferIx,
    );

    transaction.feePayer = senderAddress;
    yield this.createUnsignedTx(
      { transaction, signers: [message] },
      'TokenBridge.TransferTokens',
    );
  }

  private async *redeemAndUnwrap(
    sender: AnySolanaAddress,
    vaa: TokenBridge.TransferVAA,
  ) {
    // sender, fee payer
    const payerPublicKey = new SolanaAddress(sender).unwrap();

    // (maybe) ATA for this account
    const targetPublicKey = new SolanaAddress(vaa.payload.to.address).unwrap();

    const targetAmount = await getMint(this.connection, NATIVE_MINT).then(
      (info) =>
        vaa.payload.token.amount * BigInt(Math.pow(10, info.decimals - 8)),
    );

    const rentBalance = await getMinimumBalanceForRentExemptAccount(
      this.connection,
    );

    const ancillaryKeypair = Keypair.generate();

    const completeTransferIx = createCompleteTransferNativeInstruction(
      this.connection,
      this.tokenBridge.programId,
      this.coreBridge.address,
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

    const transaction = new Transaction();
    transaction.feePayer = payerPublicKey;
    transaction.add(
      completeTransferIx,
      createAncillaryAccountIx,
      initAccountIx,
      balanceTransferIx,
      closeAccountIx,
    );
    yield this.createUnsignedTx(
      { transaction, signers: [ancillaryKeypair] },
      'TokenBridge.RedeemAndUnwrap',
    );
  }

  private async *createAta(sender: AnySolanaAddress, token: AnySolanaAddress) {
    const senderAddress = new SolanaAddress(sender).unwrap();
    const tokenAddress = new SolanaAddress(token).unwrap();
    const ata = await getAssociatedTokenAddress(tokenAddress, senderAddress);

    // If the ata doesn't exist yet, create it
    const acctInfo = await this.connection.getAccountInfo(ata);
    if (acctInfo === null) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          senderAddress,
          ata,
          senderAddress,
          tokenAddress,
        ),
      );
      transaction.feePayer = senderAddress;
      yield this.createUnsignedTx({ transaction }, 'Redeem.CreateATA');
    }
  }

  async *redeem(
    sender: AnySolanaAddress,
    vaa: TokenBridge.TransferVAA,
    unwrapNative: boolean = true,
  ) {
    // Find the token address local to this chain
    const nativeAddress =
      vaa.payload.token.chain === this.chain
        ? vaa.payload.token.address
        : (await this.getWrappedAsset(vaa.payload.token)).toUniversalAddress();

    // Create an ATA if necessary
    yield* this.createAta(sender, nativeAddress);

    // Post the VAA if necessary
    yield* this.coreBridge.postVaa(sender, vaa);

    // redeem vaa and unwrap to native sol from wrapped sol
    if (unwrapNative) {
      // Check if this is native wrapped sol
      const wrappedNative = new SolanaAddress(await this.getWrappedNative());
      if (
        encoding.bytes.equals(
          nativeAddress.toUint8Array(),
          wrappedNative.toUint8Array(),
        )
      ) {
        yield* this.redeemAndUnwrap(sender, vaa);
        return;
      }
    }

    const senderAddress = new SolanaAddress(sender).unwrap();

    const createCompleteTransferInstruction =
      vaa.payload.token.chain == this.chain
        ? createCompleteTransferNativeInstruction
        : createCompleteTransferWrappedInstruction;

    const transaction = new Transaction().add(
      createCompleteTransferInstruction(
        this.connection,
        this.tokenBridge.programId,
        this.coreBridge.address,
        senderAddress,
        vaa,
      ),
    );
    transaction.feePayer = senderAddress;
    yield this.createUnsignedTx({ transaction }, 'Solana.RedeemTransfer');
  }

  private createUnsignedTx(
    txReq: SolanaTransaction,
    description: string,
    parallelizable: boolean = false,
  ): SolanaUnsignedTransaction<N, C> {
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
