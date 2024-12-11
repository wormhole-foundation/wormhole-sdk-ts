import type { Connection } from '@solana/web3.js';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  CircleTransferMessage,
  Contracts,
  Network,
  Platform,
} from '@wormhole-foundation/sdk-connect';
import { CircleBridge, circle } from '@wormhole-foundation/sdk-connect';

import type { Program } from '@coral-xyz/anchor';
import BN from 'bn.js';

import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type {
  SolanaChains,
  SolanaTransaction,
} from '@wormhole-foundation/sdk-solana';
import {
  SolanaAddress,
  SolanaPlatform,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
import type { MessageTransmitter, TokenMessenger } from './index.js';
import {
  createReadOnlyMessageTransmitterProgramInterface,
  createReadOnlyTokenMessengerProgramInterface,
} from './utils/index.js';
import {
  calculateFirstNonce,
  createDepositForBurnInstruction,
  createReceiveMessageInstruction,
  nonceAccount,
} from './utils/instructions/index.js';

export class SolanaCircleBridge<N extends Network, C extends SolanaChains>
  implements CircleBridge<N, C>
{
  readonly tokenMessenger: Program<TokenMessenger>;
  readonly messageTransmitter: Program<MessageTransmitter>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('CircleBridge not supported on Devnet');

    const msgTransmitterAddress = contracts.cctp?.messageTransmitter;
    if (!msgTransmitterAddress)
      throw new Error(
        `Circle Messenge Transmitter contract for domain ${chain} not found`,
      );

    this.messageTransmitter = createReadOnlyMessageTransmitterProgramInterface(
      new PublicKey(msgTransmitterAddress),
      this.connection,
    );

    const tokenMessengerAddress = contracts.cctp?.tokenMessenger;
    if (!tokenMessengerAddress)
      throw new Error(
        `Circle Token Messenger contract for domain ${chain} not found`,
      );
    this.tokenMessenger = createReadOnlyTokenMessengerProgramInterface(
      new PublicKey(tokenMessengerAddress),
      this.connection,
    );
  }

  static async fromRpc<N extends Network>(
    provider: Connection,
    config: ChainsConfig<N, Platform>,
  ): Promise<SolanaCircleBridge<N, SolanaChains>> {
    const [network, chain] = await SolanaPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    return new SolanaCircleBridge(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  async *redeem(
    sender: AccountAddress<C>,
    message: CircleBridge.Message,
    attestation: string,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const usdc = new PublicKey(
      circle.usdcContract.get(this.network, this.chain)!,
    );

    const senderPk = new SolanaAddress(sender).unwrap();

    // If the ATA doesn't exist then create it
    const mintRecipient = new SolanaAddress(
      message.payload.mintRecipient,
    ).unwrap();
    const ata = await this.connection.getAccountInfo(mintRecipient);

    if (!ata) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          senderPk,
          mintRecipient,
          senderPk,
          usdc,
        ),
      );

      transaction.feePayer = senderPk;
      yield this.createUnsignedTx({ transaction }, 'CircleBridge.CreateATA');
    }

    const ix = await createReceiveMessageInstruction(
      this.messageTransmitter.programId,
      this.tokenMessenger.programId,
      usdc,
      message,
      attestation,
      senderPk,
    );

    const transaction = new Transaction();
    transaction.feePayer = senderPk;
    transaction.add(ix);
    yield this.createUnsignedTx({ transaction }, 'CircleBridge.Redeem');
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const usdc = new PublicKey(
      circle.usdcContract.get(this.network, this.chain)!,
    );

    const senderPk = new SolanaAddress(sender).unwrap();
    const senderATA = getAssociatedTokenAddressSync(usdc, senderPk);

    const destinationDomain = circle.circleChainId.get(
      this.network,
      recipient.chain,
    )!;
    const destinationAddress = recipient.address.toUniversalAddress();

    const msgSndEvnet = Keypair.generate();

    const ix = await createDepositForBurnInstruction(
      this.messageTransmitter.programId,
      this.tokenMessenger.programId,
      usdc,
      destinationDomain,
      senderPk,
      senderATA,
      destinationAddress,
      amount,
      msgSndEvnet.publicKey,
    );

    const transaction = new Transaction();
    transaction.feePayer = senderPk;
    transaction.add(ix);

    yield this.createUnsignedTx(
      { transaction, signers: [msgSndEvnet] },
      'CircleBridge.Transfer',
    );
  }

  async isTransferCompleted(message: CircleBridge.Message): Promise<boolean> {
    const usedNoncesAddress = nonceAccount(
      message.nonce,
      message.sourceDomain as circle.CircleChainId,
      this.messageTransmitter.programId,
    );
    const firstNonce = calculateFirstNonce(message.nonce);

    // usedNonces should be a [u64;100] where each bit is a nonce flag
    const { usedNonces } =
      await this.messageTransmitter.account.usedNonces.fetch(usedNoncesAddress);

    // get the nonce index based on the account's first nonce
    const nonceIndex = Number(message.nonce - firstNonce);

    // get the the u64 the nonce's flag is in
    const nonceElement = usedNonces[Math.floor(nonceIndex / 64)];
    if (!nonceElement) throw new Error('Invalid nonce byte index');

    // get the nonce flag index and build a bitmask
    const nonceBitIndex = nonceIndex % 64;
    // NOTE: js does not correctly handle large bitshifts, leave these as bigint wrapped
    const mask = new BN((BigInt(1) << BigInt(nonceBitIndex)).toString());
    return !nonceElement.and(mask).isZero();
  }

  // Fetch the transaction logs and parse the CircleTransferMessage
  async parseTransactionDetails(txid: string): Promise<CircleTransferMessage> {
    const tx = await this.connection.getTransaction(txid);
    if (!tx || !tx.meta) throw new Error('Transaction not found');

    const acctKeys = tx.transaction.message.getAccountKeys();
    if (acctKeys.length < 2) throw new Error('No message account found');

    const msgSendAccount = acctKeys.get(1);
    const accountData = await this.connection.getAccountInfo(msgSendAccount!);
    if (!accountData) throw new Error('No account data found');
    // TODO: why 44?
    const message = new Uint8Array(accountData.data).slice(44);

    const [msg, hash] = CircleBridge.deserialize(message);

    const { payload: body } = msg;

    const xferSender = body.messageSender;
    const xferReceiver = body.mintRecipient;

    const sendChain = circle.toCircleChain(this.network, msg.sourceDomain);
    const rcvChain = circle.toCircleChain(this.network, msg.destinationDomain);

    const token = { chain: sendChain, address: body.burnToken };

    return {
      from: { chain: sendChain, address: xferSender },
      to: { chain: rcvChain, address: xferReceiver },
      token: token,
      amount: body.amount,
      message: msg,
      id: { hash },
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
