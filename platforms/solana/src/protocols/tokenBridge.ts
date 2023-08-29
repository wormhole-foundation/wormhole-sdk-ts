import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
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
} from '@wormhole-foundation/sdk-definitions';

import { Wormhole as WormholeCore } from '../utils/types/wormhole';

import { TokenBridge as TokenBridgeContract } from '../utils/types/tokenBridge';
import {
  createApproveAuthoritySignerInstruction,
  createTransferWrappedInstruction,
  createTransferWrappedWithPayloadInstruction,
  deriveWrappedMintKey,
  getWrappedMeta,
} from '../utils/tokenBridge';

import { SolanaContracts } from '../contracts';
import { SolanaAddress } from '../address';
import { SolanaUnsignedTransaction } from '../unsignedTransaction';
import { SolanaChainName, UniversalOrSolana } from '../types';

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
          address: new SolanaAddress(mint.toBytes()),
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

  async getWrappedAsset(token: TokenId): Promise<SolanaAddress> {
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

  private async *transferSol(
    sender: UniversalOrSolana,
    recipient: ChainAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    //  https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/solana/context.ts#L245
    //   //This will create a temporary account where the wSOL will be created.
    //   const createAncillaryAccountIx = SystemProgram.createAccount({
    //     fromPubkey: payerPublicKey,
    //     newAccountPubkey: ancillaryKeypair.publicKey,
    //     lamports: rentBalance, //spl token accounts need rent exemption
    //     space: ACCOUNT_SIZE,
    //     programId: TOKEN_PROGRAM_ID,
    //   });
  }

  async *transfer(
    sender: UniversalOrSolana,
    recipient: ChainAddress,
    token: UniversalOrSolana | 'native',
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    // TODO: payer vs sender?? can caller add diff payer later?

    if (token === 'native')
      return this.transferSol(sender, recipient, amount, payload);

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

  //alternative naming: completeTransfer
  async *redeem(
    sender: UniversalOrSolana,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative: boolean = true,
  ): AsyncGenerator<SolanaUnsignedTransaction> {
    throw new Error('not implemented');
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
