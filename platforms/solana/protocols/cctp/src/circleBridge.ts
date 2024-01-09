import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  CircleBridge,
  CircleTransferMessage,
  Contracts,
  Network,
  Platform,
  circle,
} from '@wormhole-foundation/connect-sdk';

import { BN, EventParser, Program } from '@project-serum/anchor';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-solana';
import { MessageTransmitter, TokenMessenger } from '.';
import {
  createReadOnlyMessageTransmitterProgramInterface,
  createReadOnlyTokenMessengerProgramInterface,
} from './utils';
import {
  calculateFirstNonce,
  createDepositForBurnInstruction,
  createReceiveMessageInstruction,
  nonceAccount,
} from './utils/instructions';

export class SolanaCircleBridge<N extends Network, C extends SolanaChains>
  implements CircleBridge<N, SolanaPlatformType, C>
{
  readonly tokenMessenger: Program<TokenMessenger>;
  readonly messageTransmitter: Program<MessageTransmitter>;

  private constructor(
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

    const destinationDomain = circle.circleChainId.get(recipient.chain)!;
    const destinationAddress = recipient.address.toUniversalAddress();

    const ix = await createDepositForBurnInstruction(
      this.messageTransmitter.programId,
      this.tokenMessenger.programId,
      usdc,
      destinationDomain,
      senderPk,
      senderATA,
      destinationAddress,
      amount,
    );

    const transaction = new Transaction();
    transaction.feePayer = senderPk;
    transaction.add(ix);

    yield this.createUnsignedTx({ transaction }, 'CircleBridge.Transfer');
  }

  async isTransferCompleted(message: CircleBridge.Message): Promise<boolean> {
    const usedNoncesAddress = nonceAccount(
      message.nonce,
      message.sourceDomain,
      this.messageTransmitter.programId,
    );

    const firstNonce = calculateFirstNonce(message.nonce);

    // usedNonces should be a [u64;100] where each bit is a nonce flag
    const { usedNonces } =
      // @ts-ignore --
      await this.messageTransmitter.account.usedNonces.fetch(usedNoncesAddress);

    // get the nonce index based on the account's first nonce
    const nonceIndex = Number(message.nonce - firstNonce);

    // get the the u64 the nonce's flag is in
    const nonceElement = usedNonces[Math.floor(nonceIndex / 64)];
    if (!nonceElement) throw new Error('Invalid nonce byte index');

    // get the nonce flag index and build a bitmask
    const nonceBitIndex = nonceIndex % 64;
    const mask = new BN(1 << nonceBitIndex);

    // If the flag is 0 it is _not_ used
    return !nonceElement.and(mask).isZero();
  }

  // Fetch the transaction logs and parse the CircleTransferMessage
  async parseTransactionDetails(txid: string): Promise<CircleTransferMessage> {
    const tx = await this.connection.getTransaction(txid);
    if (!tx || !tx.meta) throw new Error('Transaction not found');

    // this log contains the cctp message information
    const messageTransmitterParser = new EventParser(
      this.messageTransmitter.programId,
      this.messageTransmitter.coder,
    );

    const messageLogs = [
      ...messageTransmitterParser.parseLogs(tx.meta.logMessages || []),
    ];

    if (messageLogs.length === 0)
      throw new Error('No CircleTransferMessage found');

    const message = new Uint8Array(messageLogs[0]!.data['message'] as Buffer);
    const [msg, hash] = CircleBridge.deserialize(message);

    const { payload: body } = msg;

    const xferSender = body.messageSender;
    const xferReceiver = body.mintRecipient;

    const sendChain = circle.toCircleChain(msg.sourceDomain);
    const rcvChain = circle.toCircleChain(msg.destinationDomain);

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
