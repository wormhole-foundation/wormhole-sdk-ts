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
  deserializeCircleMessage,
  encoding,
  nativeChainAddress,
} from '@wormhole-foundation/connect-sdk';

import { EventParser, Program } from '@project-serum/anchor';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-solana';
import { MessageTransmitter } from './messageTransmitter';
import { TokenMessenger } from './tokenMessenger';
import {
  createReadOnlyMessageTransmitterProgramInterface,
  createReadOnlyTokenMessengerProgramInterface,
} from './utils';
import {
  createDepositForBurnInstruction,
  createReceiveMessageInstruction,
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
    message: string,
    attestation: string,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const usdc = new PublicKey(
      circle.usdcContract.get(this.network, this.chain),
    );

    const senderPk = new SolanaAddress(sender).unwrap();

    const [circleMsg, _] = deserializeCircleMessage(
      encoding.hex.decode(message),
    );

    const ix = await createReceiveMessageInstruction(
      this.messageTransmitter.programId,
      this.tokenMessenger.programId,
      usdc,
      circleMsg,
      message,
      attestation,
      senderPk,
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPk;
    transaction.add(ix);

    yield this.createUnsignedTx(transaction, 'CircleBridge.Redeem');
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const usdc = new PublicKey(
      circle.usdcContract.get(this.network, this.chain),
    );

    const senderPk = new SolanaAddress(sender).unwrap();
    const senderATA = getAssociatedTokenAddressSync(usdc, senderPk);

    const destinationDomain = circle.circleChainId.get(recipient.chain);
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

    const { blockhash } = await this.connection.getLatestBlockhash();
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPk;
    transaction.add(ix);

    yield this.createUnsignedTx(transaction, 'CircleBridge.Transfer');
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
    const message = new Uint8Array(messageLogs[0].data['message'] as Buffer);
    const [msg, hash] = deserializeCircleMessage(message);

    const { payload: body } = msg;

    const xferSender = body.messageSender;
    const xferReceiver = body.mintRecipient;

    const sendChain = circle.toCircleChain(msg.sourceDomain);
    const rcvChain = circle.toCircleChain(msg.destinationDomain);

    const token = nativeChainAddress(sendChain, body.burnToken);

    return {
      from: nativeChainAddress(sendChain, xferSender),
      to: nativeChainAddress(rcvChain, xferReceiver),
      token: token,
      amount: body.amount,
      messageId: { message: encoding.hex.encode(message), hash },
    };
  }

  private createUnsignedTx(
    txReq: Transaction,
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
