import {
  CircleChainName,
  circleChainId,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
  ChainAddress,
  CircleTransferDetails,
  CircleBridge,
  UnsignedTransaction,
  keccak256,
  TokenId,
  toNative,
} from '@wormhole-foundation/connect-sdk';

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

//https://github.com/circlefin/evm-cctp-contracts

export class EvmCircleBridge implements CircleBridge<'Evm'> {
  readonly chainId: bigint;
  readonly msgTransmitter: MessageTransmitter.MessageTransmitter;
  readonly tokenMessenger: TokenMessenger.TokenMessenger;

  readonly tokenEventHash: string;
  readonly messageEventHash: string;

  private constructor(
    readonly network: 'Mainnet' | 'Testnet',
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: EvmContracts,
  ) {
    this.chainId = evmNetworkChainToEvmChainId(network, chain);

    this.msgTransmitter = this.contracts.mustGetCircleMessageTransmitter(
      chain,
      provider,
    );
    this.tokenMessenger = this.contracts.mustGetCircleTokenMessenger(
      chain,
      provider,
    );

    this.tokenEventHash =
      this.tokenMessenger.getEvent('DepositForBurn').fragment.topicHash;

    this.messageEventHash =
      this.msgTransmitter.getEvent('MessageReceived').fragment.topicHash;
  }

  static async fromProvider(
    provider: Provider,
    contracts: EvmContracts,
  ): Promise<EvmCircleBridge> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmCircleBridge(network, chain, provider, contracts);
  }

  async *redeem(
    sender: UniversalOrEvm,
    message: string,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);

    const parsedMsg = new Uint8Array(
      Buffer.from(message.startsWith('0x') ? message.slice(2) : message, 'hex'),
    );
    const parsedAttest = new Uint8Array(
      Buffer.from(
        attestation.startsWith('0x') ? attestation.slice(2) : attestation,
        'hex',
      ),
    );

    const txReq = await this.msgTransmitter.receiveMessage.populateTransaction(
      parsedMsg,
      parsedAttest,
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
    const recipientAddress = recipient.address.toString();
    const tokenAddr = toEvmAddrString(token.address as UniversalOrEvm);

    const tokenContract = this.contracts.mustGetTokenImplementation(
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

  // https://goerli.etherscan.io/tx/0xe4984775c76b8fe7c2b09cd56fb26830f6e5c5c6b540eb97d37d41f47f33faca#eventlog
  async parseTransactionDetails(txid: string): Promise<CircleTransferDetails> {
    const receipt = await this.provider.getTransactionReceipt(txid);
    if (!receipt) throw new Error(`No receipt for ${txid} on ${this.chain}`);

    const tokenLogs = receipt.logs
      .filter((log) => log.topics[0] === this.tokenEventHash)
      .map((tokenLog) => {
        const { topics, data } = tokenLog;
        return this.tokenMessenger.interface.parseLog({
          topics: topics.slice(),
          data: data,
        });
      })
      .filter((l): l is LogDescription => !!l);

    if (tokenLogs.length === 0)
      throw new Error(`No log message for token transfer found in ${txid}`);
    const [tokenLog] = tokenLogs;

    const messageLogs = receipt.logs
      .filter((log) => log.topics[0] === this.messageEventHash)
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
      throw new Error(`Found more than one message in ${txid}`);

    const [messageLog] = messageLogs;

    const message = Buffer.from(
      (messageLog.args.message as string).slice(2),
      'hex',
    );
    const msgBytes = new Uint8Array(message);
    const messageHash = `0x${Buffer.from(keccak256(msgBytes)).toString('hex')}`;

    return {
      txid: receipt.hash,
      from: {
        chain: this.chain,
        address: toNative(this.chain, receipt.from).toUniversalAddress(),
      },
      token: {
        chain: this.chain,
        address: toNative(
          this.chain,
          tokenLog.args.burnToken,
        ).toUniversalAddress(),
      },
      amount: tokenLog.args.amount,
      destination: {
        recipient: tokenLog.args.mintRecipient,
        domain: tokenLog.args.destinationDomain,
        tokenMessenger: tokenLog.args.destinationTokenMessenger,
        caller: tokenLog.args.destinationCaller,
      },
      messageId: {
        message: message.toString('hex'),
        msgHash: messageHash,
      },
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
