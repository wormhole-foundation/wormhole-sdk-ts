import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  TokenAddress,
  TokenBridgeExecutor,
} from '@wormhole-foundation/sdk-connect';
import {
  contracts,
  isNative,
  relayInstructionsLayout,
  serializeLayout,
  signedQuoteLayout,
  toChainId,
  toUniversal,
} from '@wormhole-foundation/sdk-connect';
import type {
  SolanaChains,
  SolanaTransaction,
} from '@wormhole-foundation/sdk-solana';
import {
  SolanaAddress,
  SolanaPlatform,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';

import { Program } from '@coral-xyz/anchor';

import type {
  AddressLookupTableAccount,
  Connection,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import '@wormhole-foundation/sdk-solana-core';

import BN from 'bn.js';
import {
  TokenBridgeExecutorRelayer,
  TokenBridgeExecutorRelayerIdl,
} from './tokenBridgeExecutorTypes.js';
import {
  SolanaWormholeCore,
  utils,
} from '@wormhole-foundation/sdk-solana-core';
import { SolanaTokenBridge } from './tokenBridge.js';
import {
  deriveWrappedMetaKey,
  deriveEndpointKey,
  deriveMintAuthorityKey,
} from './utils/index.js';

export class SolanaTokenBridgeExecutor<
  N extends Network,
  C extends SolanaChains,
> implements TokenBridgeExecutor<N, C>
{
  readonly relayerProgramId: PublicKey;
  readonly executorProgramId: PublicKey;
  readonly wormholeProgramId: PublicKey;
  readonly tokenBridgeProgramId: PublicKey;

  readonly relayerProgram: Program<TokenBridgeExecutorRelayer>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    this.relayerProgramId = new PublicKey(
      contracts.tokenBridgeExecutorRelayer!,
    );
    this.executorProgramId = new PublicKey(contracts.executor!);
    this.wormholeProgramId = new PublicKey(contracts.coreBridge!);
    this.tokenBridgeProgramId = new PublicKey(contracts.tokenBridge!);

    this.relayerProgram = new Program<TokenBridgeExecutorRelayer>(
      TokenBridgeExecutorRelayerIdl as TokenBridgeExecutorRelayer,
      this.relayerProgramId,
      { connection: this.connection },
    );
  }

  static async fromRpc<N extends Network>(
    connection: Connection,
    config: ChainsConfig<N, Platform>,
  ): Promise<SolanaTokenBridgeExecutor<N, SolanaChains>> {
    const [network, chain] = await SolanaPlatform.chainFromRpc(connection);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new SolanaTokenBridgeExecutor(
      network as N,
      chain,
      connection,
      conf.contracts,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    executorQuote: TokenBridgeExecutor.ExecutorQuote,
    referrerFee?: TokenBridgeExecutor.ReferrerFee,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const dstExecutor = contracts.tokenBridgeExecutor.get(
      this.network,
      recipient.chain,
    );
    if (!dstExecutor || !dstExecutor.relayer) {
      throw new Error(
        `Token Bridge Executor Relayer contract for domain ${recipient.chain} not found`,
      );
    }
    const dstRelayer = dstExecutor.relayer;

    const senderPubkey = new SolanaAddress(sender).unwrap();
    const targetChain = toChainId(recipient.chain);
    const targetRecipient = recipient.address.toUniversalAddress();

    const { estimatedCost, signedQuote, relayInstructions } = executorQuote;

    const signedQuoteBytes = serializeLayout(signedQuoteLayout, signedQuote);
    const relayInstructionsBytes = serializeLayout(
      relayInstructionsLayout,
      relayInstructions,
    );

    const tokenBridge = new SolanaTokenBridge(
      this.network,
      this.chain,
      this.connection,
      this.contracts,
    );

    const isNativeToken = isNative(token);
    const isWrappedAsset =
      !isNativeToken && (await tokenBridge.isWrappedAsset(token));

    const mint = isNativeToken
      ? NATIVE_MINT
      : new SolanaAddress(token).unwrap();

    const tokenProgram = await SolanaPlatform.getTokenProgramId(
      this.connection,
      mint,
    );

    const payeePubkey = new PublicKey(signedQuote.quote.payeeAddress);

    const messageKeypair = Keypair.generate();

    const dstTransferRecipient = toUniversal(recipient.chain, dstRelayer);
    const dstExecutionAddress = dstTransferRecipient;

    // Derive PDAs
    const tokenBridgeConfig = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      this.tokenBridgeProgramId,
    )[0];

    const tokenBridgeCustody = PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      this.tokenBridgeProgramId,
    )[0];

    const tokenBridgeAuthoritySigner = PublicKey.findProgramAddressSync(
      [Buffer.from('authority_signer')],
      this.tokenBridgeProgramId,
    )[0];

    const tokenBridgeCustodySigner = PublicKey.findProgramAddressSync(
      [Buffer.from('custody_signer')],
      this.tokenBridgeProgramId,
    )[0];

    const {
      wormholeEmitter: tokenBridgeEmitterId,
      wormholeSequence: tokenBridgeSequence,
      wormholeFeeCollector,
      wormholeBridge,
    } = utils.getWormholeDerivedAccounts(
      this.tokenBridgeProgramId,
      this.wormholeProgramId,
    );

    const config = PublicKey.findProgramAddressSync(
      [Buffer.from('sender')],
      this.relayerProgramId,
    )[0];

    const fromTokenAccount = getAssociatedTokenAddressSync(
      mint,
      senderPubkey,
      false,
      tokenProgram,
    );

    const tmpTokenAccount = PublicKey.findProgramAddressSync(
      [Buffer.from('tmp'), mint.toBytes()],
      this.relayerProgramId,
    )[0];

    const instructions: TransactionInstruction[] = [];

    if (referrerFee && referrerFee.feeAmount > 0n) {
      const referrer = new PublicKey(referrerFee.referrer.address.toString());

      const referrerAta = getAssociatedTokenAddressSync(
        mint,
        referrer,
        true,
        tokenProgram,
      );

      const senderAta = getAssociatedTokenAddressSync(
        mint,
        senderPubkey,
        true,
        tokenProgram,
      );

      const referrerAtaAccount =
        await this.connection.getAccountInfo(referrerAta);

      if (!referrerAtaAccount) {
        instructions.push(
          createAssociatedTokenAccountIdempotentInstruction(
            senderPubkey,
            referrerAta,
            referrer,
            mint,
            tokenProgram,
          ),
        );
      }

      instructions.push(
        createTransferInstruction(
          senderAta,
          referrerAta,
          senderPubkey,
          referrerFee.feeAmount,
          undefined,
          tokenProgram,
        ),
      );
    }

    const transferAmount = referrerFee ? referrerFee.remainingAmount : amount;

    // Build transfer instruction data
    const transferArgs = {
      amount: new BN(transferAmount.toString()),
      recipientChain: targetChain,
      recipientAddress: Array.from(targetRecipient.toUint8Array()),
      nonce: 0,
      dstTransferRecipient: Array.from(dstTransferRecipient.toUint8Array()),
      dstExecutionAddress: Array.from(dstExecutionAddress.toUint8Array()),
      execAmount: new BN(estimatedCost.toString()),
      signedQuoteBytes: Buffer.from(signedQuoteBytes),
      relayInstructions: Buffer.from(relayInstructionsBytes),
    };

    if (!isWrappedAsset) {
      instructions.push(
        await this.relayerProgram.methods
          .transferNativeTokensWithRelay({
            ...transferArgs,
            wrapNative: isNative(token),
          })
          .accountsStrict({
            payer: senderPubkey,
            config,
            mint, // SPL token that will be bridged
            fromTokenAccount, // init_if_needed
            tmpTokenAccount, // tmp custodies the tokens before being xferred
            tokenBridgeConfig,
            tokenBridgeCustody,
            tokenBridgeAuthoritySigner,
            tokenBridgeCustodySigner,
            wormholeBridge,
            wormholeMessage: messageKeypair.publicKey,
            tokenBridgeEmitter: tokenBridgeEmitterId,
            tokenBridgeSequence,
            wormholeFeeCollector,
            payee: payeePubkey,
            systemProgram: SystemProgram.programId,
            tokenProgram,
            wormholeProgram: this.wormholeProgramId,
            tokenBridgeProgram: this.tokenBridgeProgramId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            executorProgram: this.executorProgramId,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      );
    } else {
      instructions.push(
        await this.relayerProgram.methods
          .transferWrappedTokensWithRelay(transferArgs)
          .accountsStrict({
            payer: senderPubkey,
            config,
            tokenBridgeWrappedMint: mint,
            fromTokenAccount,
            tmpTokenAccount,
            tokenBridgeWrappedMeta: deriveWrappedMetaKey(
              this.tokenBridgeProgramId,
              mint,
            ),
            tokenBridgeConfig,
            tokenBridgeAuthoritySigner,
            wormholeBridge,
            wormholeMessage: messageKeypair.publicKey,
            tokenBridgeEmitter: tokenBridgeEmitterId,
            tokenBridgeSequence,
            wormholeFeeCollector,
            payee: payeePubkey,
            wormholeProgram: this.wormholeProgramId,
            tokenBridgeProgram: this.tokenBridgeProgramId,
            systemProgram: SystemProgram.programId,
            tokenProgram,
            executorProgram: this.executorProgramId,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      );
    }

    // Build versioned transaction
    const lut = await this.getAddressLookupTable();
    const { blockhash } = await this.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: senderPubkey,
      instructions,
      recentBlockhash: blockhash,
    }).compileToV0Message(lut ? [lut] : []);

    const transaction = new VersionedTransaction(messageV0);

    yield this.createUnsignedTx(
      { transaction, signers: [messageKeypair] },
      'TokenBridgeExecutor.transfer',
    );
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridgeExecutor.VAA,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const senderPubkey = new SolanaAddress(sender).unwrap();
    const recipientPubkey = new SolanaAddress(
      vaa.payload.payload.targetRecipient,
    ).unwrap();

    const tokenChain = vaa.payload.token.chain;
    const tokenAddress = vaa.payload.token.address;
    const isNativeToken = tokenChain === this.chain;

    let mint: PublicKey;
    if (isNativeToken) {
      mint = new SolanaAddress(tokenAddress).unwrap();
    } else {
      // For wrapped tokens, derive the wrapped mint key using the token's origin chain
      const tokenBridge = new SolanaTokenBridge(
        this.network,
        this.chain,
        this.connection,
        this.contracts,
      );
      const wrappedAsset = await tokenBridge.getWrappedAsset({
        chain: tokenChain,
        address: tokenAddress,
      });
      mint = new SolanaAddress(wrappedAsset).unwrap();
    }

    const tokenProgram = await SolanaPlatform.getTokenProgramId(
      this.connection,
      mint,
    );

    // Derive recipient token account (ATA)
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      mint,
      recipientPubkey,
      true,
      tokenProgram,
    );

    // Post VAA if necessary
    const postedVaaKey = utils.derivePostedVaaKey(
      this.wormholeProgramId,
      Buffer.from(vaa.hash),
    );

    const isPosted = await this.connection.getAccountInfo(postedVaaKey);
    if (!isPosted) {
      const wormholeCore = new SolanaWormholeCore(
        this.network,
        this.chain,
        this.connection,
        this.contracts,
      );

      yield* wormholeCore.postVaa(senderPubkey, vaa);
    }

    const dstRelayer = new SolanaAddress(vaa.payload.to.address).unwrap();

    // Build redeem transaction
    const dstRelayerProgram = new Program<TokenBridgeExecutorRelayer>(
      TokenBridgeExecutorRelayerIdl as TokenBridgeExecutorRelayer,
      dstRelayer,
      { connection: this.connection },
    );

    // Derive required accounts
    const config = PublicKey.findProgramAddressSync(
      [Buffer.from('redeemer')],
      dstRelayerProgram.programId,
    )[0];

    const tokenBridgeConfig = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      this.tokenBridgeProgramId,
    )[0];

    const tmpTokenAccount = PublicKey.findProgramAddressSync(
      [Buffer.from('tmp'), mint.toBytes()],
      dstRelayerProgram.programId,
    )[0];

    const tokenBridgeClaim = utils.deriveClaimKey(
      this.tokenBridgeProgramId,
      vaa.emitterAddress.toUint8Array(),
      toChainId(vaa.emitterChain),
      vaa.sequence,
    );

    const tokenBridgeForeignEndpoint = deriveEndpointKey(
      this.tokenBridgeProgramId,
      toChainId(vaa.emitterChain),
      vaa.emitterAddress.toUint8Array(),
    );

    const tokenBridgeCustody = PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      this.tokenBridgeProgramId,
    )[0];

    const tokenBridgeCustodySigner = PublicKey.findProgramAddressSync(
      [Buffer.from('custody_signer')],
      this.tokenBridgeProgramId,
    )[0];

    let instruction: TransactionInstruction;
    const vaaHash = Array.from(vaa.hash);

    if (isNativeToken) {
      instruction = await dstRelayerProgram.methods
        .completeNativeTransferWithRelay(vaaHash)
        .accountsStrict({
          payer: senderPubkey,
          config,
          mint,
          recipientTokenAccount,
          recipient: recipientPubkey,
          tmpTokenAccount,
          tokenBridgeConfig,
          vaa: postedVaaKey,
          tokenBridgeClaim,
          tokenBridgeForeignEndpoint,
          tokenBridgeCustody,
          tokenBridgeCustodySigner,
          wormholeProgram: this.wormholeProgramId,
          tokenBridgeProgram: this.tokenBridgeProgramId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();
    } else {
      instruction = await dstRelayerProgram.methods
        .completeWrappedTransferWithRelay(vaaHash)
        .accountsStrict({
          payer: senderPubkey,
          config,
          tokenBridgeWrappedMint: mint,
          recipientTokenAccount,
          recipient: recipientPubkey,
          tmpTokenAccount,
          tokenBridgeWrappedMeta: deriveWrappedMetaKey(
            this.tokenBridgeProgramId,
            mint,
          ),
          tokenBridgeConfig,
          vaa: postedVaaKey,
          tokenBridgeClaim,
          tokenBridgeForeignEndpoint,
          tokenBridgeMintAuthority: deriveMintAuthorityKey(
            this.tokenBridgeProgramId,
          ),
          wormholeProgram: this.wormholeProgramId,
          tokenBridgeProgram: this.tokenBridgeProgramId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();
    }

    // Build versioned transaction
    const { blockhash } = await this.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: senderPubkey,
      instructions: [instruction],
      recentBlockhash: blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    yield this.createUnsignedTx(
      { transaction, signers: [] },
      'TokenBridgeExecutor.redeem',
    );
  }

  async getAddressLookupTable(): Promise<AddressLookupTableAccount | null> {
    const lutPointer = PublicKey.findProgramAddressSync(
      [Buffer.from('lut')],
      this.relayerProgramId,
    )[0];

    try {
      const lutAddress = // @ts-ignore
        (await this.relayerProgram.account.lut.fetch(lutPointer)).address;

      const lut = await this.connection.getAddressLookupTable(lutAddress);
      if (lut.value) {
        return lut.value;
      }
    } catch {}

    return null;
  }

  async estimateMsgValueAndGasLimit(recipient?: ChainAddress): Promise<{
    msgValue: bigint;
    gasLimit: bigint;
  }> {
    // Solana doesn't use gas in the same way as EVM chains
    // Return reasonable defaults for compatibility
    let msgValue = 0n;
    // These are estimates with some padding, actual values may vary
    msgValue += 2n * 5000n + 7n * 5000n + 1_400_000n; // post vaa, 2 sigs + 7 Secp256k1 SigVerify Precompile + 1 sig account rent (59 bytes)
    msgValue += 2n * 5000n + 7n * 5000n; // post vaa, 2 signatures + 7 Secp256k1 SigVerify Precompile
    msgValue += 5000n + 3_200_000n; // core bridge post vaa account
    msgValue += 5000n + 5_000_000n; // receive wormhole message accounts
    msgValue += 5000n; // release has no accounts, unless sending to a new ATA

    return {
      //   msgValue: 5001n * 5n + 1200000n + 3100000n + 1500000n + 2942120n, // TODO: better values
      msgValue: 0n,
      gasLimit: 1_000_000n, // Compute units on Solana
    };
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
