import {
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  getMinimumBalanceForRentExemptAccount,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  Account,
} from '@solana/spl-token';
import {
  clusterApiUrl,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  ChainName,
  ChainId,
  toChainId,
  toChainName,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import {
  CONFIG,
  Platform,
  // chainToChainId,
  // parseTokenTransferPayload,
  // parseTokenTransferVaa,
  // parseVaa,
  TokenId,
  // ChainName,
  // ChainId,
  // NATIVE,
  // ParsedMessage,
  // Context,
  // ParsedRelayerPayload,
  // ParsedRelayerMessage,
  Wormhole,
  TokenTransferTransaction,
  // TokenBridgeAbstract,
  // SolanaAbstract,
} from '@wormhole-foundation/connect-sdk';

import { SolContracts } from './contracts';
// import {
//   createTransferNativeInstruction,
//   createTransferWrappedInstruction,
//   createTransferNativeWithPayloadInstruction,
//   createApproveAuthoritySignerInstruction,
//   createTransferWrappedWithPayloadInstruction,
// } from './utils/tokenBridge';
import {
  deriveWormholeEmitterKey,
  getClaim,
  getPostedMessage,
} from './utils/wormhole';
import {
  getForeignAssetSolana,
  redeemAndUnwrapOnSolana,
  redeemOnSolana,
} from './utils';
import { hexByteStringToUint8Array, uint8ArrayToHexByteString } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { SolanaAddress } from './address';
import { parseTokenTransferPayload } from '@certusone/wormhole-sdk';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';
const SOLANA_CHAIN_NAME = CONFIG['Mainnet'].chains.Solana!.key;

const sharedEmitter =
  '3b26409f8aaded3f5ddca184695aa6a0fa829b0c85caf84856324896d214ca98';
const SOLANA_EMMITER_ID = {
  Mainnet: 'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5',
  Testnet: sharedEmitter,
  Devnet: sharedEmitter,
};

/**
 * @category Solana
 */
export class SolanaPlatform implements Platform {
  static readonly platform: PlatformName = 'Solana';
  readonly contracts: SolContracts;
  protected wormhole: Wormhole;
  connection: Connection | undefined;

  constructor(wormholeInstance: Wormhole, connection?: Connection) {
    this.wormhole = wormholeInstance;
    const tag = this.wormhole.network === 'Mainnet' ? 'mainnet-beta' : 'devnet';
    this.connection = connection || new Connection(clusterApiUrl(tag));
    this.contracts = new SolContracts(this.wormhole.network, this.connection);
  }

  /**
   * Sets the Connection
   *
   * @param connection The Solana Connection
   */
  async setConnection(connection: Connection) {
    this.connection = connection;
  }

  getChain(chain: ChainName): SolanaChain {
    return new SolanaChain(this, chain);
  }

  async getTokenDecimals(
    tokenAddr: UniversalAddress,
    chain?: ChainName,
  ): Promise<bigint> {
    if (!this.connection) throw new Error('no connection');
    let mint = await this.connection.getParsedAccountInfo(
      new PublicKey(tokenAddr),
    );
    if (!mint) throw new Error('could not fetch token details');
    const { decimals } = (mint as any).value.data.parsed.info;
    return decimals;
  }

  // /**
  //  * Gets the owner address of an Associated Token Account
  //  *
  //  * @param accountAddr The associated token account address
  //  * @returns The owner address
  //  */
  // async getTokenAccountOwner(accountAddr: string): Promise<string> {
  //   const token = await getAccount(
  //     this.connection!,
  //     new PublicKey(accountAddr),
  //   );
  //   return token.owner.toString();
  // }

  async getNativeBalance(
    walletAddr: string,
    chain: ChainName,
  ): Promise<bigint> {
    if (!this.connection) throw new Error('no connection');
    const balance = await this.connection.getBalance(
      new PublicKey(walletAddr),
    );
    return BigInt(balance);
  }

  async getTokenBalance(
    walletAddress: string,
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<bigint | null> {
    if (!this.connection) throw new Error('no connection');
    const address = await this.getForeignAsset(tokenId, chain);
    if (!address) return null;
    const splToken = await this.connection.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(address) },
    );
    if (!splToken.value[0]) return null;
    const balance = await this.connection.getTokenAccountBalance(
      splToken.value[0].pubkey,
    );

    return BigInt(balance.value.amount);
  }

  // /**
  //  * Gets the Associate Token Address
  //  *
  //  * @param token The token id (home chain/address)
  //  * @param account The wallet address
  //  * @returns The associated token address
  //  */
  // async getAssociatedTokenAddress(
  //   token: TokenId,
  //   account: PublicKeyInitData,
  // ): Promise<PublicKey> {
  //   const solAddr = await this.mustGetForeignAsset(token, SOLANA_CHAIN_NAME);
  //   return await getAssociatedTokenAddress(
  //     new PublicKey(solAddr),
  //     new PublicKey(account),
  //     undefined,
  //     TOKEN_PROGRAM_ID,
  //     ASSOCIATED_TOKEN_PROGRAM_ID,
  //   );
  // }

  // async getRecipientAddress(
  //   tokenId: TokenId,
  //   recipientAddress: string,
  // ): Promise<string> {
  //   const account = await this.getAssociatedTokenAddress(
  //     tokenId,
  //     recipientAddress,
  //   );
  //   return account.toString();
  // }

  // /**
  //  * Gets the Associate Token Account
  //  *
  //  * @param token The token id (home chain/address)
  //  * @param account The wallet address
  //  * @returns The account, or null if it does not exist
  //  */
  // async getAssociatedTokenAccount(
  //   token: TokenId,
  //   account: PublicKeyInitData,
  // ): Promise<Account | null> {
  //   if (!this.connection) throw new Error('no connection');
  //   const addr = await this.getAssociatedTokenAddress(token, account);
  //   try {
  //     const account = await getAccount(this.connection, addr);
  //     return account;
  //   } catch (_) {
  //     return null;
  //   }
  // }

  // /**
  //  * Creates the Associated Token Account for a given wallet address. This must exist before a user can send a token bridge transfer, also it is the recipient address when sending the transfer.
  //  *
  //  * @param token The token id (home chain/address)
  //  * @param account The wallet address
  //  * @param commitment The commitment level
  //  * @returns The transaction for creating the Associated Token Account
  //  */
  // async createAssociatedTokenAccount(
  //   token: TokenId,
  //   account: PublicKeyInitData,
  //   commitment?: Commitment,
  // ): Promise<Transaction | void> {
  //   if (!this.connection) throw new Error('no connection');
  //   const tokenAccount = await this.getAssociatedTokenAccount(token, account);
  //   if (tokenAccount) return;

  //   const solAddr = await this.mustGetForeignAsset(token, SOLANA_CHAIN_NAME);
  //   const associatedAddr = await this.getAssociatedTokenAddress(token, account);
  //   const payerPublicKey = new PublicKey(account);
  //   const tokenPublicKey = new PublicKey(solAddr);
  //   const associatedPublicKey = new PublicKey(associatedAddr);

  //   const createAccountInst = createAssociatedTokenAccountInstruction(
  //     payerPublicKey,
  //     associatedPublicKey,
  //     payerPublicKey,
  //     tokenPublicKey,
  //   );
  //   const transaction = new Transaction().add(createAccountInst);
  //   const { blockhash } = await this.connection.getLatestBlockhash(commitment);
  //   transaction.recentBlockhash = blockhash;
  //   transaction.feePayer = payerPublicKey;
  //   return transaction;
  // }

  // /**
  //  * Prepare the transfer instructions for a native token bridge transfer from Solana
  //  *
  //  * @dev This _must_ be claimed on the destination chain, see {@link Wormhole#completeTransfer | completeTransfer}
  //  *
  //  * @param senderAddress The address of the sender
  //  * @param amount The token amount to be sent
  //  * @param recipientChain The destination chain name or id
  //  * @param recipientAddress The associated token address where funds will be sent
  //  * @param relayerFee The fee that would be paid to a relayer
  //  * @param payload Arbitrary bytes that can contain any addition information about a given transfer
  //  * @param commitment The commitment level
  //  * @returns The transaction for sending Native SOL from Solana
  //  */
  // private async transferNativeSol(
  //   senderAddress: PublicKeyInitData,
  //   amount: bigint,
  //   recipientChain: ChainId | ChainName,
  //   recipientAddress: Uint8Array | Buffer,
  //   relayerFee?: bigint,
  //   payload?: Uint8Array | Buffer,
  //   commitment?: Commitment,
  // ): Promise<Transaction> {
  //   if (!this.connection) throw new Error('no connection');
  //   const contracts = this.contracts.mustGetContracts(SOLANA_CHAIN_NAME);
  //   if (!contracts.CoreBridge || !contracts.TokenBridge) {
  //     throw new Error('contracts not found');
  //   }

  //   const rentBalance = await getMinimumBalanceForRentExemptAccount(
  //     this.connection,
  //     commitment,
  //   );
  //   const payerPublicKey = new PublicKey(senderAddress);
  //   const ancillaryKeypair = Keypair.generate();

  //   //This will create a temporary account where the wSOL will be created.
  //   const createAncillaryAccountIx = SystemProgram.createAccount({
  //     fromPubkey: payerPublicKey,
  //     newAccountPubkey: ancillaryKeypair.publicKey,
  //     lamports: rentBalance, //spl token accounts need rent exemption
  //     space: ACCOUNT_SIZE,
  //     programId: TOKEN_PROGRAM_ID,
  //   });

  //   //Send in the amount of SOL which we want converted to wSOL
  //   const initialBalanceTransferIx = SystemProgram.transfer({
  //     fromPubkey: payerPublicKey,
  //     lamports: amount,
  //     toPubkey: ancillaryKeypair.publicKey,
  //   });
  //   //Initialize the account as a WSOL account, with the original payerAddress as owner
  //   const initAccountIx = createInitializeAccountInstruction(
  //     ancillaryKeypair.publicKey,
  //     NATIVE_MINT,
  //     payerPublicKey,
  //   );

  //   //Normal approve & transfer instructions, except that the wSOL is sent from the ancillary account.
  //   const approvalIx = createApproveAuthoritySignerInstruction(
  //     contracts.TokenBridge,
  //     ancillaryKeypair.publicKey,
  //     payerPublicKey,
  //     amount,
  //   );

  //   const message = Keypair.generate();
  //   const nonce = 0;
  //   const tokenBridgeTransferIx = payload
  //     ? createTransferNativeWithPayloadInstruction(
  //         this.connection,
  //         contracts.TokenBridge,
  //         contracts.CoreBridge,
  //         senderAddress,
  //         message.publicKey,
  //         ancillaryKeypair.publicKey,
  //         NATIVE_MINT,
  //         nonce,
  //         amount,
  //         Buffer.from(recipientAddress),
  //         toChainId(recipientChain),
  //         payload,
  //       )
  //     : createTransferNativeInstruction(
  //         this.connection,
  //         contracts.TokenBridge,
  //         contracts.CoreBridge,
  //         senderAddress,
  //         message.publicKey,
  //         ancillaryKeypair.publicKey,
  //         NATIVE_MINT,
  //         nonce,
  //         amount,
  //         relayerFee || BigInt(0),
  //         Buffer.from(recipientAddress),
  //         toChainId(recipientChain),
  //       );

  //   //Close the ancillary account for cleanup. Payer address receives any remaining funds
  //   const closeAccountIx = createCloseAccountInstruction(
  //     ancillaryKeypair.publicKey, //account to close
  //     payerPublicKey, //Remaining funds destination
  //     payerPublicKey, //authority
  //   );

  //   const { blockhash } = await this.connection.getLatestBlockhash(commitment);
  //   const transaction = new Transaction();
  //   transaction.recentBlockhash = blockhash;
  //   transaction.feePayer = payerPublicKey;
  //   transaction.add(
  //     createAncillaryAccountIx,
  //     initialBalanceTransferIx,
  //     initAccountIx,
  //     approvalIx,
  //     tokenBridgeTransferIx,
  //     closeAccountIx,
  //   );
  //   transaction.partialSign(message, ancillaryKeypair);
  //   return transaction;
  // }

  // /**
  //  * Prepare the transfer instructions for a token bridge transfer from Solana
  //  *
  //  * @dev This _must_ be claimed on the destination chain, see {@link Wormhole#completeTransfer | completeTransfer}
  //  *
  //  * @param senderAddress The address of the sender
  //  * @param amount The token amount to be sent
  //  * @param recipientChain The destination chain name or id
  //  * @param recipientAddress The associated token address where funds will be sent
  //  * @param fromAddress The token account pubkey, owned by fromOwner address
  //  * @param tokenChainId The id of the token's chain
  //  * @param mintAddress The token address on the destination
  //  * @param fromOwnerAddress If not specified, will default to the sender address
  //  * @param relayerFee The fee that would be paid to a relayer
  //  * @param payload Arbitrary bytes that can contain any addition information about a given transfer
  //  * @param commitment The commitment level
  //  * @returns The transaction for sending tokens from Solana
  //  */
  // private async transferFromSolana(
  //   senderAddress: PublicKeyInitData,
  //   amount: bigint,
  //   recipientChain: ChainId | ChainName,
  //   recipientAddress: Uint8Array | Buffer,
  //   fromAddress: PublicKeyInitData, // token account pubkey, owned by fromOwner address
  //   tokenChainId: number,
  //   mintAddress: Uint8Array, // token address
  //   fromOwnerAddress?: PublicKeyInitData,
  //   relayerFee?: bigint,
  //   payload?: Uint8Array | Buffer,
  //   commitment?: Commitment,
  // ): Promise<Transaction> {
  //   if (!this.connection) throw new Error('no connection');
  //   const contracts = this.contracts.mustGetContracts(SOLANA_CHAIN_NAME);
  //   if (!contracts.CoreBridge || !contracts.TokenBridge) {
  //     throw new Error('contracts not found');
  //   }

  //   const recipientChainId = toChainId(recipientChain);
  //   if (fromOwnerAddress === undefined) {
  //     fromOwnerAddress = senderAddress;
  //   }
  //   const nonce = 0;
  //   const approvalIx = createApproveAuthoritySignerInstruction(
  //     contracts.TokenBridge,
  //     fromAddress,
  //     new PublicKey(fromOwnerAddress),
  //     amount,
  //   );
  //   const message = Keypair.generate();

  //   const tokenBridgeTransferIx = payload
  //     ? createTransferWrappedWithPayloadInstruction(
  //         this.connection,
  //         contracts.TokenBridge,
  //         contracts.CoreBridge,
  //         senderAddress,
  //         message.publicKey,
  //         fromAddress,
  //         fromOwnerAddress,
  //         tokenChainId,
  //         mintAddress,
  //         nonce,
  //         amount,
  //         recipientAddress,
  //         recipientChainId,
  //         payload,
  //       )
  //     : createTransferWrappedInstruction(
  //         this.connection,
  //         contracts.TokenBridge,
  //         contracts.CoreBridge,
  //         senderAddress,
  //         message.publicKey,
  //         fromAddress,
  //         fromOwnerAddress,
  //         tokenChainId,
  //         mintAddress,
  //         nonce,
  //         amount,
  //         relayerFee || BigInt(0),
  //         recipientAddress,
  //         recipientChainId,
  //       );
  //   const transaction = new Transaction().add(
  //     approvalIx,
  //     tokenBridgeTransferIx,
  //   );
  //   const { blockhash } = await this.connection.getLatestBlockhash(commitment);
  //   transaction.recentBlockhash = blockhash;
  //   transaction.feePayer = new PublicKey(senderAddress);
  //   transaction.partialSign(message);
  //   return transaction;
  // }

  // async startTransfer(
  //   token: TokenId | typeof NATIVE,
  //   amount: bigint,
  //   sendingChain: ChainName | ChainId,
  //   senderAddress: string,
  //   recipientChain: ChainName | ChainId,
  //   recipientAddress: string,
  //   relayerFee?: string,
  //   commitment?: Commitment,
  // ): Promise<Transaction> {
  //   if (!this.connection) throw new Error('no connection');
  //   const destContext = this.wormhole.getContext(recipientChain);
  //   const formattedRecipient = hexByteStringToUint8Array(
  //     destContext.formatAddress(recipientAddress),
  //   );
  //   const relayerFeeBN = relayerFee ? BigInt(relayerFee) : undefined;

  //   if (token === NATIVE) {
  //     return await this.transferNativeSol(
  //       senderAddress,
  //       amount,
  //       recipientChain,
  //       formattedRecipient,
  //       relayerFeeBN,
  //       undefined,
  //       'finalized',
  //     );
  //   } else {
  //     const tokenContext = this.wormhole.getContext(token.chain);
  //     const formattedTokenAddr = hexByteStringToUint8Array(
  //       await tokenContext.formatAssetAddress(token.address),
  //     );
  //     const solTokenAddr = await this.mustGetForeignAsset(
  //       token,
  //       SOLANA_CHAIN_NAME,
  //     );
  //     const splToken = await this.connection.getTokenAccountsByOwner(
  //       new PublicKey(senderAddress),
  //       { mint: new PublicKey(solTokenAddr) },
  //     );
  //     if (!splToken || !splToken.value[0])
  //       throw new Error('account does not have any token balance');

  //     return await this.transferFromSolana(
  //       senderAddress,
  //       amount,
  //       recipientChain,
  //       formattedRecipient,
  //       splToken.value[0].pubkey,
  //       toChainId(token.chain),
  //       formattedTokenAddr,
  //       undefined,
  //       relayerFeeBN,
  //       undefined,
  //       'finalized',
  //     );
  //   }
  // }

  // async startTransferWithPayload(
  //   token: TokenId | typeof NATIVE,
  //   amount: bigint,
  //   sendingChain: ChainName | ChainId,
  //   senderAddress: string,
  //   recipientChain: ChainName | ChainId,
  //   recipientAddress: string,
  //   payload: Uint8Array | Buffer,
  //   commitment?: Commitment,
  // ): Promise<Transaction> {
  //   if (!this.connection) throw new Error('no connection');
  //   const destContext = this.wormhole.getContext(recipientChain);
  //   const formattedRecipient = hexByteStringToUint8Array(
  //     destContext.formatAddress(recipientAddress),
  //   );

  //   if (token === NATIVE) {
  //     return await this.transferNativeSol(
  //       senderAddress,
  //       amount,
  //       recipientChain,
  //       formattedRecipient,
  //       undefined,
  //       payload,
  //       'finalized',
  //     );
  //   } else {
  //     const tokenContext = this.wormhole.getContext(token.chain);
  //     const formattedTokenAddr = hexByteStringToUint8Array(
  //       await tokenContext.formatAssetAddress(token.address),
  //     );
  //     const solTokenAddr = await this.mustGetForeignAsset(
  //       token,
  //       SOLANA_CHAIN_NAME,
  //     );
  //     const splToken = await this.connection.getTokenAccountsByOwner(
  //       new PublicKey(senderAddress),
  //       { mint: new PublicKey(solTokenAddr) },
  //     );
  //     if (!splToken || !splToken.value[0])
  //       throw new Error('account does not have any token balance');

  //     return await this.transferFromSolana(
  //       senderAddress,
  //       amount,
  //       recipientChain,
  //       formattedRecipient,
  //       splToken.value[0].pubkey,
  //       toChainId(token.chain),
  //       formattedTokenAddr,
  //       undefined,
  //       undefined,
  //       payload,
  //       'finalized',
  //     );
  //   }
  // }

  formatAddress(address: PublicKeyInitData): Uint8Array {
    const addr =
      typeof address === 'string' && address.startsWith('0x')
        ? hexByteStringToUint8Array(address)
        : address;
    return new PublicKey(addr).toBytes();
  }

  parseAddress(address: string): UniversalAddress {
    return new UniversalAddress(new PublicKey(address).toBytes());
  }

  // async formatAssetAddress(address: string): Promise<Uint8Array> {
  //   return this.formatAddress(address);
  // }

  // async parseAssetAddress(address: string): Promise<string> {
  //   return this.parseAddress(address);
  // }

  async getForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress | null> {
    if (!this.connection) throw new Error('no connection');

    const chainId = toChainId(tokenId[0]);
    const destChainId = toChainId(chain);
    if (destChainId === chainId) return tokenId[1];

    const contracts = this.wormhole.mustGetContracts(chain);
    if (!contracts.TokenBridge) throw new Error('contracts not found');

    const addr = await getForeignAssetSolana(
      this.connection,
      contracts.TokenBridge,
      chainId,
      tokenId[1].unwrap(),
    );
    if (!addr) return null;
    return new SolanaAddress(addr).toUniversalAddress();
  }

  // async mustGetForeignAsset(
  //   tokenId: TokenId,
  //   chain: ChainName | ChainId,
  // ): Promise<string> {
  //   const addr = await this.getForeignAsset(tokenId, chain);
  //   if (!addr) throw new Error('token not registered');
  //   return addr;
  // }

  async parseMessageFromTx(
    tx: string,
    chain: ChainName | ChainId,
  ): Promise<TokenTransferTransaction[]> {
    if (!this.connection) throw new Error('no connection');
    const contracts = this.contracts.mustGetContracts(SOLANA_CHAIN_NAME);
    if (!contracts.CoreBridge || !contracts.TokenBridge)
      throw new Error('contracts not found');
    const response = await this.connection.getTransaction(tx);
    const parsedResponse = await this.connection.getParsedTransaction(tx);
    if (!response || !response.meta?.innerInstructions![0].instructions)
      throw new Error('transaction not found');

    const instructions = response.meta?.innerInstructions![0].instructions;
    const accounts = response.transaction.message.accountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeInstructions = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex].toString();
      const emitterId = accounts[i.accounts[2]];
      const wormholeCore = contracts.CoreBridge;
      const tokenBridge = deriveWormholeEmitterKey(contracts.TokenBridge!);
      return programId === wormholeCore && emitterId.equals(tokenBridge);
    });
    const { message } = await getPostedMessage(
      this.connection,
      accounts[bridgeInstructions[0].accounts[1]],
    );

    const parsedInstr =
      parsedResponse?.meta?.innerInstructions![0].instructions;
    const gasFee = parsedInstr
      ? parsedInstr.reduce((acc, c: any) => {
          if (!c.parsed || !c.parsed.info || !c.parsed.info.lamports)
            return acc;
          return acc + c.parsed.info.lamports;
        }, 0)
      : 0;

    // parse message payload
    const parsed = parseTokenTransferPayload(message.payload);

    // get sequence
    const sequence = response.meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');
    if (!sequence) {
      throw new Error('sequence not found');
    }

    // format response
    const tokenContext = this.wormhole.getContext(parsed.tokenChain as ChainId);
    const destContext = this.wormhole.getContext(parsed.toChain as ChainId);

    // const tokenAddress = await tokenContext.parseAssetAddress(
    //   uint8ArrayToHexByteString(parsed.tokenAddress),
    // );
    const tokenAddress = new UniversalAddress(parsed.tokenAddress);
    const tokenChain = toChainName(parsed.tokenChain);

    const toAddress = destContext.parseAddress(uint8ArrayToHexByteString(parsed.to));

    const parsedMessage: TokenTransferTransaction = {
      sendTx: tx,
      sender: accounts[0].toString(),
      amount: BigInt(parsed.amount),
      payloadID: BigInt(parsed.payloadType),
      recipient: toAddress,
      toChain: toChainName(parsed.toChain),
      fromChain: toChainName(chain),
      tokenAddress: tokenAddress,
      tokenChain,
      tokenId: [
        toChainName(tokenChain),
        tokenAddress,
      ],
      sequence: BigInt(sequence),
      emitterAddress: SOLANA_EMMITER_ID[this.wormhole.conf.network],
      gasFee: BigInt(gasFee),
      block: BigInt(response.slot),
    };

    if (parsedMessage.payloadID === BigInt(3)) {
      // TODO:
      // const destContext = this.wormhole.getPlatform(toChainName(parsed.toChain));
      // const parsedPayload = destContext.parseRelayerPayload(
      //   parsed.tokenTransferPayload,
      // );
      // const parsedPayloadMessage: ParsedRelayerMessage = {
      //   ...parsedMessage,
      //   relayerPayloadId: parsedPayload.relayerPayloadId,
      //   recipient: destContext.parseAddress(parsedPayload.to),
      //   to: toAddress,
      //   relayerFee: parsedPayload.relayerFee,
      //   toNativeTokenAmount: parsedPayload.toNativeTokenAmount,
      // };
      // return [parsedPayloadMessage];
    }

    return [parsedMessage];
  }

  // async completeTransfer(
  //   destChain: ChainName | ChainId,
  //   signedVAA: Uint8Array,
  //   overrides: any,
  //   payerAddr?: PublicKeyInitData,
  // ): Promise<Transaction> {
  //   if (!payerAddr)
  //     throw new Error(
  //       'receiving wallet address required for completing transfer on Solana',
  //     );
  //   if (!this.connection) throw new Error('no connection');
  //   const contracts = this.contracts.mustGetContracts(SOLANA_CHAIN_NAME);
  //   if (!contracts.CoreBridge || !contracts.TokenBridge) {
  //     throw new Error('contracts not found for solana');
  //   }

  //   const parsed = parseTokenTransferVaa(signedVAA);
  //   const tokenChain = parsed.tokenChain;
  //   if (tokenChain === toChainId('Solana')) {
  //     return await redeemAndUnwrapOnSolana(
  //       this.connection,
  //       contracts.CoreBridge,
  //       contracts.TokenBridge,
  //       payerAddr,
  //       signedVAA,
  //     );
  //   } else {
  //     return await redeemOnSolana(
  //       this.connection,
  //       contracts.CoreBridge,
  //       contracts.TokenBridge,
  //       payerAddr,
  //       signedVAA,
  //     );
  //   }
  // }

  // async isTransferCompleted(
  //   destChain: ChainName | ChainId,
  //   signedVaa: string,
  // ): Promise<boolean> {
  //   if (!this.connection) throw new Error('no connection');
  //   const parsed = parseVaa(hexByteStringToUint8Array(signedVaa));
  //   const tokenBridge = this.contracts.mustGetBridge(destChain);
  //   return getClaim(
  //     this.connection,
  //     tokenBridge.programId,
  //     parsed.emitterAddress,
  //     parsed.emitterChain,
  //     parsed.sequence,
  //     'finalized',
  //   ).catch((e) => false);
  // }

  // async getCurrentBlock(): Promise<number> {
  //   if (!this.connection) throw new Error('no connection');
  //   return await this.connection.getSlot();
  // }

  // parseRelayerPayload(payload: Buffer): ParsedRelayerPayload {
  //   throw new Error('relaying is not supported on solana');
  // }
}
