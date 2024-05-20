import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  CircleTransferMessage,
  Contracts,
  Network,
  Platform,
} from '@wormhole-foundation/sdk-connect';
import {
  CircleBridge,
  circle,
  encoding,
  nativeChainIds,
} from '@wormhole-foundation/sdk-connect';

import type {
  MessageTransmitter,
  TokenMessenger,
} from './ethers-contracts/index.js';

import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import type { LogDescription, Provider, TransactionRequest } from 'ethers';
import { ethers } from 'ethers';
import { ethers_contracts } from './index.js';
//https://github.com/circlefin/evm-cctp-contracts

export class EvmCircleBridge<N extends Network, C extends EvmChains>
  implements CircleBridge<N, C>
{
  readonly chainId: bigint;
  readonly circleChainId: number;

  readonly msgTransmitter: MessageTransmitter.MessageTransmitter;
  readonly tokenMessenger: TokenMessenger.TokenMessenger;

  readonly tokenEventHash: string;
  readonly messageSentEventHash: string;
  readonly messageReceivedEventHash: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('CircleBridge not supported on Devnet');

    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    const circleChainId = circle.circleChainId.get(network, chain);
    if (circleChainId === undefined)
      throw new Error(`Circle chain id not found for ${network} ${chain}`);
    this.circleChainId = circleChainId;

    const msgTransmitterAddress = contracts.cctp?.messageTransmitter;
    if (!msgTransmitterAddress)
      throw new Error(
        `Circle Messenge Transmitter contract for domain ${chain} not found`,
      );

    this.msgTransmitter = ethers_contracts.MessageTransmitter__factory.connect(
      msgTransmitterAddress,
      provider,
    );

    const tokenMessengerAddress = contracts.cctp?.tokenMessenger;
    if (!tokenMessengerAddress)
      throw new Error(
        `Circle Token Messenger contract for domain ${chain} not found`,
      );

    this.tokenMessenger = ethers_contracts.TokenMessenger__factory.connect(
      tokenMessengerAddress,
      provider,
    );

    this.tokenEventHash =
      this.tokenMessenger.getEvent('DepositForBurn').fragment.topicHash;

    this.messageSentEventHash =
      this.msgTransmitter.getEvent('MessageSent').fragment.topicHash;

    this.messageReceivedEventHash =
      this.msgTransmitter.getEvent('MessageReceived').fragment.topicHash;
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmCircleBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    return new EvmCircleBridge(network as N, chain, provider, conf.contracts);
  }

  async *redeem(
    sender: AccountAddress<C>,
    message: CircleBridge.Message,
    attestation: string,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();

    const txReq = await this.msgTransmitter.receiveMessage.populateTransaction(
      CircleBridge.serialize(message),
      encoding.hex.decode(attestation),
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'CircleBridge.redeem',
    );
  }
  //alternative naming: initiateTransfer
  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();

    const tokenAddr = circle.usdcContract.get(this.network, this.chain)!;

    const tokenContract = EvmPlatform.getTokenImplementation(
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
      circle.circleChainId.get(this.network, recipient.chain)!,
      recipientAddress,
      tokenAddr,
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'CircleBridge.transfer',
    );
  }

  async isTransferCompleted(message: CircleBridge.Message): Promise<boolean> {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['uint32', 'uint64'],
        [message.sourceDomain, message.nonce],
      ),
    );
    const result = await this.msgTransmitter.usedNonces.staticCall(hash);
    return result.toString() === '1';
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
    const { message } = messageLog!.args;
    const [circleMsg, hash] = CircleBridge.deserialize(
      encoding.hex.decode(message),
    );
    const { payload: body } = circleMsg;

    const xferSender = body.messageSender;
    const xferReceiver = body.mintRecipient;

    const sendChain = circle.toCircleChain(
      this.network,
      circleMsg.sourceDomain,
    );
    const rcvChain = circle.toCircleChain(
      this.network,
      circleMsg.destinationDomain,
    );

    const token = { chain: sendChain, address: body.burnToken };

    return {
      from: { chain: sendChain, address: xferSender },
      to: { chain: rcvChain, address: xferReceiver },
      token: token,
      amount: body.amount,
      message: circleMsg,
      id: { hash },
    };
  }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    parallelizable: boolean = false,
  ): EvmUnsignedTransaction<N, C> {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
