import {
  CircleChainName,
  circleChainId,
  ChainAddress,
  CircleBridge,
  UnsignedTransaction,
  TokenId,
  Network,
  nativeChainAddress,
  hexByteStringToUint8Array,
  deserializeCircleMessage,
  toCircleChainName,
  CircleTransferMessage,
} from '@wormhole-foundation/connect-sdk';

import { evmNetworkChainToEvmChainId } from '../constants';
import {
  addFrom,
  addChainId,
  toEvmAddrString,
  EvmChainName,
  UniversalOrEvm,
} from '../types';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { MessageTransmitter, TokenMessenger } from '../ethers-contracts';
import { LogDescription, Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from '../contracts';
import { EvmPlatform } from '../platform';

//https://github.com/circlefin/evm-cctp-contracts

export class EvmCircleBridge implements CircleBridge<'Evm'> {
  readonly chainId: bigint;
  readonly msgTransmitter: MessageTransmitter.MessageTransmitter;
  readonly tokenMessenger: TokenMessenger.TokenMessenger;

  readonly tokenEventHash: string;
  readonly messageSentEventHash: string;
  readonly messageReceivedEventHash: string;

  private constructor(
    readonly network: Network,
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: EvmContracts,
  ) {
    if (network === 'Devnet')
      throw new Error('CircleBridge not supported on Devnet');

    this.chainId = evmNetworkChainToEvmChainId(network, chain);

    this.msgTransmitter = this.contracts.getCircleMessageTransmitter(
      chain,
      provider,
    );
    this.tokenMessenger = this.contracts.getCircleTokenMessenger(
      chain,
      provider,
    );

    this.tokenEventHash =
      this.tokenMessenger.getEvent('DepositForBurn').fragment.topicHash;

    this.messageSentEventHash =
      this.msgTransmitter.getEvent('MessageSent').fragment.topicHash;

    this.messageReceivedEventHash =
      this.msgTransmitter.getEvent('MessageReceived').fragment.topicHash;
  }

  static async fromProvider(
    provider: Provider,
    contracts: EvmContracts,
  ): Promise<EvmCircleBridge> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    return new EvmCircleBridge(network, chain, provider, contracts);
  }

  async *redeem(
    sender: UniversalOrEvm,
    message: string,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);

    const txReq = await this.msgTransmitter.receiveMessage.populateTransaction(
      hexByteStringToUint8Array(message),
      hexByteStringToUint8Array(attestation),
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'CircleBridge.redeem',
    );
  }
  //alternative naming: initiateTransfer
  async *transfer(
    token: TokenId,
    sender: UniversalOrEvm,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
    const tokenAddr = toEvmAddrString(token.address as UniversalOrEvm);

    const tokenContract = EvmContracts.getTokenImplementation(
      this.provider,
      tokenAddr,
    );

    const allowance = await tokenContract.allowance(
      senderAddr,
      this.tokenMessenger.target,
    );

    if (allowance < amount) {
      const txReq = await tokenContract.approve.populateTransaction(
        this.tokenMessenger.target,
        amount,
      );
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'ERC20.approve of CircleBridge',
        false,
      );
    }

    const txReq = await this.tokenMessenger.depositForBurn.populateTransaction(
      amount,
      circleChainId(recipient.chain as CircleChainName),
      recipientAddress,
      tokenAddr,
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'CircleBridge.transfer',
    );
  }

  // Fetch the transaction logs and parse the CircleTransferMessage
  async parseTransactionDetails(txid: string): Promise<CircleTransferMessage> {
    const receipt = await this.provider.getTransactionReceipt(txid);
    if (!receipt) throw new Error(`No receipt for ${txid} on ${this.chain}`);

    const messageLogs = receipt.logs
      .filter((log) => log.topics[0] === this.messageSentEventHash)
      .map((messageLog) => {
        const { topics, data } = messageLog;
        return this.msgTransmitter.interface.parseLog({
          topics: topics.slice(),
          data: data,
        });
      })
      .filter((l): l is LogDescription => !!l);

    if (messageLogs.length === 0)
      throw new Error(
        `No log message for message transmitter found in ${txid}`,
      );

    // just taking the first one here, will there ever be >1?
    if (messageLogs.length > 1)
      console.error(
        `Expected 1 event to be found for transaction, got>${messageLogs.length}}`,
      );

    const [messageLog] = messageLogs;
    const { message } = messageLog.args;
    const [header, body, hash] = deserializeCircleMessage(
      hexByteStringToUint8Array(message),
    );

    const xferSender = body.messageSender;
    const xferReceiver = body.mintRecipient;

    const sendChain = toCircleChainName(header.sourceDomain);
    const rcvChain = toCircleChainName(header.destinationDomain);

    const token = nativeChainAddress([sendChain, body.burnToken]);

    return {
      from: nativeChainAddress([sendChain, xferSender]),
      to: nativeChainAddress([rcvChain, xferReceiver]),
      token: token,
      amount: body.amount,
      messageId: { message, hash },
    };
  }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    parallelizable: boolean = false,
  ): EvmUnsignedTransaction {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
