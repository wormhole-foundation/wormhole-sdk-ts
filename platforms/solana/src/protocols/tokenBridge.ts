import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  ACCOUNT_SIZE,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptAccount,
} from '@solana/spl-token';
import { Program } from '@project-serum/anchor';

import {
  ChainId,
  Network,
  solGenesisHashToNetworkChainPair,
  toChainId,
  toChainName,
} from '@wormhole-foundation/sdk-base';
import {
  TokenBridge,
  ChainAddress,
  VAA,
  WrappedTokenId,
  TokenId,
  UniversalAddress,
  NativeAddress,
  serialize,
  deserialize,
} from '@wormhole-foundation/sdk-definitions';

import { Wormhole as WormholeCore } from '../utils/types/wormhole';

import { TokenBridge as TokenBridgeContract } from '../utils/types/tokenBridge';
import {
  createApproveAuthoritySignerInstruction,
  createCompleteTransferNativeInstruction,
  createCompleteTransferWrappedInstruction,
  createTransferNativeInstruction,
  createTransferNativeWithPayloadInstruction,
  createTransferWrappedInstruction,
  createTransferWrappedWithPayloadInstruction,
  deriveWrappedMintKey,
  getWrappedMeta,
} from '../utils/tokenBridge';

import { SolanaContracts } from '../contracts';
import { SolanaAddress } from '../address';
import { SolanaUnsignedTransaction } from '../unsignedTransaction';
import { SolanaChainName, UniversalOrSolana } from '../types';
import {
  createPostVaaInstruction,
  createVerifySignaturesInstructions,
} from '../utils/wormhole';

export class SolanaTokenBridge implements TokenBridge<'Solana'> {
  readonly chainId: ChainId;

  readonly tokenBridge: Program<TokenBridgeContract>;
  readonly coreBridge: Program<WormholeCore>;

  private constructor(
    readonly network: Network,
    readonly chain: SolanaChainName,
    readonly connection: Connection,
    readonly contracts: SolanaContracts,
  ) {
    this.chainId = toChainId(chain);
    this.tokenBridge = this.contracts.mustGetTokenBridge(chain, connection);
    this.coreBridge = this.contracts.mustGetCore(chain, connection);
  }

  static async fromProvider(
    connection: Connection,
    contracts: SolanaContracts,
  ): Promise<SolanaTokenBridge> {
    const gh = await connection.getGenesisHash();
    const netChain = solGenesisHashToNetworkChainPair.get(gh);
    if (!netChain)
      throw new Error(
        `No matching genesis hash to determine network and chain: ${gh}`,
      );

    const [network, chain] = netChain;
    return new SolanaTokenBridge(network, chain, connection, contracts);
  }

  async isWrappedAsset(token: UniversalOrSolana): Promise<boolean> {
    return getWrappedMeta(
      this.connection,
      this.tokenBridge.programId,
      token.toUint8Array(),
    )
      .catch((_) => null)
      .then((meta) => meta != null);
  }

  async getOriginalAsset(token: UniversalOrSolana): Promise<TokenId> {
    const mint = new PublicKey(token.toUint8Array());

    try {
      const meta = await getWrappedMeta(
        this.connection,
        this.tokenBridge.programId,
        token.toUint8Array(),
      );

      if (meta === null)
        return {
          chain: this.chain,
          address: new SolanaAddress(mint.toBytes()).toUniversalAddress(),
        };

      return {
        chain: toChainName(meta.chain as ChainId),
        address: new UniversalAddress(meta.tokenAddress),
      };
    } catch (_) {
      // TODO: https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/token_bridge/getOriginalAsset.ts#L200
      // the current one returns 0s for address
      throw new Error(`No wrapped asset for: ${token.toString()}`);
    }
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      this.getWrappedAsset(token);
      return true;
    } catch (_) {
      return false;
    }
  }

  async getWrappedAsset(token: TokenId): Promise<NativeAddress<'Solana'>> {
    const mint = deriveWrappedMintKey(
      this.tokenBridge.programId,
      toChainId(token.chain),
      token.address.toUint8Array(),
    );

    const mintAddress = await getWrappedMeta(
      this.connection,
      this.tokenBridge.programId,
      mint,
    )
      .catch((_) => null)
      .then((meta) => (meta === null ? null : mint.toString()));

    if (mintAddress === null)
      throw new Error(`No wrapped asset found for: ${token}`);

    // @ts-ignore
    return new SolanaAddress(mintAddress);
  }

  async isTransferCompleted(
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ): Promise<boolean> {
    throw new Error('not implemented');
  }

  async *createAttestation(
    token: UniversalOrSolana,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
  }

  async *submitAttestation(
    vaa: VAA<'AttestMeta'>,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
  }

  private async transferSol(
    sender: UniversalOrSolana,
    recipient: ChainAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): Promise<SolanaUnsignedTransaction> {
    //  https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/solana/context.ts#L245

    const senderAddress = new PublicKey(sender.toUint8Array());
    // TODO: why?
    const payerPublicKey = senderAddress;

    const recipientAddress = recipient.address.toUint8Array();
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
          this.coreBridge.programId,
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
          this.coreBridge.programId,
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

    const { blockhash } = await this.connection.getLatestBlockhash();
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerPublicKey;
    transaction.add(
      createAncillaryAccountIx,
      initialBalanceTransferIx,
      initAccountIx,
      approvalIx,
      tokenBridgeTransferIx,
      closeAccountIx,
    );
    transaction.partialSign(message, ancillaryKeypair);

    return this.createUnsignedTx(transaction, 'Solana.TransferNative');
  }

  async *transfer(
    sender: UniversalOrSolana,
    recipient: ChainAddress,
    token: UniversalOrSolana | 'native',
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    // TODO: payer vs sender?? can caller add diff payer later?

    if (token === 'native') {
      yield await this.transferSol(sender, recipient, amount, payload);
      return;
    }

    const senderAddress = new PublicKey(sender.toUint8Array());

    const senderTokenAddress = await getAssociatedTokenAddress(
      new PublicKey(token.toUint8Array()),
      senderAddress,
    );

    const recipientAddress = recipient.address.toUint8Array();
    const recipientChainId = toChainId(recipient.chain);

    const nonce = 0;
    const relayerFee = 0n;

    // TODO: this cant be right, right?
    const isSolanaNative = !this.isWrappedAsset(token);

    const approvalIx = createApproveAuthoritySignerInstruction(
      this.tokenBridge.programId,
      token.toUint8Array(),
      senderAddress,
      amount,
    );

    const message = Keypair.generate();
    let tokenBridgeTransferIx: TransactionInstruction | undefined;
    if (isSolanaNative) {
      throw new Error('not yet');
      // tokenBridgeTransferIx =  payload? createTransferNativeWithPayloadInstruction(
      //          tokenBridgeAddress,
      //          bridgeAddress,
      //          payerAddress,
      //          message.publicKey,
      //          fromAddress,
      //          mintAddress,
      //          nonce,
      //          amount,
      //          targetAddress,
      //          coalesceChainId(targetChain),
      //          payload,
      //        ) : createTransferNativeInstruction(
      //          tokenBridgeAddress,
      //          bridgeAddress,
      //          payerAddress,
      //          message.publicKey,
      //          fromAddress,
      //          mintAddress,
      //          nonce,
      //          amount,
      //          relayerFee,
      //          targetAddress,
      //          coalesceChainId(targetChain),
      //        )
    } else {
      const originAsset = await this.getOriginalAsset(token);

      tokenBridgeTransferIx = payload
        ? createTransferWrappedWithPayloadInstruction(
            this.connection,
            this.tokenBridge.programId,
            this.coreBridge.programId,
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
            this.coreBridge.programId,
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

    const transaction = new Transaction().add(
      approvalIx,
      tokenBridgeTransferIx,
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderAddress;
    transaction.partialSign(message);

    yield this.createUnsignedTx(transaction, 'Solana.TransferTokens');
  }

  private async postVaa(
    sender: UniversalOrSolana,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ) {
    const senderAddr = new PublicKey(sender.toUint8Array());
    const signatureSet = Keypair.generate();

    const verifySignaturesInstructions =
      await createVerifySignaturesInstructions(
        this.connection,
        this.coreBridge.programId,
        senderAddr,
        vaa,
        signatureSet.publicKey,
      );

    const unsignedTransactions: Transaction[] = [];
    for (let i = 0; i < verifySignaturesInstructions.length; i += 2) {
      unsignedTransactions.push(
        new Transaction().add(...verifySignaturesInstructions.slice(i, i + 2)),
      );
    }

    unsignedTransactions.push(
      new Transaction().add(
        createPostVaaInstruction(
          this.connection,
          this.coreBridge.programId,
          senderAddr,
          // TODO: yuk
          deserialize('Uint8Array', serialize(vaa)),
          signatureSet.publicKey,
        ),
      ),
    );

    return {
      unsignedTransactions,
      signers: [signatureSet],
    };
  }

  async *redeem(
    sender: UniversalOrSolana,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative: boolean = true,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    // TODO: check if vaa.payload.token.address is native Sol
    const { blockhash } = await this.connection.getLatestBlockhash();
    const senderAddress = new PublicKey(sender.toUint8Array());

    const { unsignedTransactions: postVaaTxns, signers: postVaaSigners } =
      await this.postVaa(sender, vaa);

    // Take off the last tx in the set of postVAA txns
    // to send after verify sig txns
    const postVaaTx = postVaaTxns.pop()!;

    for (const verifySigTx of postVaaTxns) {
      verifySigTx.recentBlockhash = blockhash;
      verifySigTx.feePayer = senderAddress;
      verifySigTx.partialSign(postVaaSigners[0]);
      yield this.createUnsignedTx(verifySigTx, 'Redeem.VerifySignature');
    }

    postVaaTx.recentBlockhash = blockhash;
    postVaaTx.feePayer = senderAddress;
    //postVaaTx.partialSign(postVaaSigners[0]);
    yield this.createUnsignedTx(postVaaTx, 'Redeem.PostVAA');

    const createCompleteTransferInstruction =
      vaa.payload.token.chain == this.chain
        ? createCompleteTransferNativeInstruction
        : createCompleteTransferWrappedInstruction;

    const transaction = new Transaction().add(
      createCompleteTransferInstruction(
        this.connection,
        this.tokenBridge.programId,
        this.coreBridge.programId,
        senderAddress,
        vaa,
      ),
    );

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderAddress;
    yield this.createUnsignedTx(transaction, 'Solana.RedeemTransfer');
  }

  private createUnsignedTx(
    txReq: Transaction,
    description: string,
    parallelizable: boolean = false,
  ): SolanaUnsignedTransaction {
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      'Solana',
      description,
      parallelizable,
    );
  }
}
