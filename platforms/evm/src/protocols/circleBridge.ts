import {
  chainToChainId,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
} from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  VAA,
  CircleBridge,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-definitions';

import {
  addFrom,
  addChainId,
  toEvmAddrString,
  EvmChainName,
  UniversalOrEvm,
} from '../types';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { MessageTransmitter, TokenMessenger } from '../ethers-contracts';
import { Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from '../contracts';
import { TokenId } from '@wormhole-foundation/connect-sdk';
import { send } from 'process';

//https://github.com/circlefin/evm-cctp-contracts

export class EvmCircleBridge implements CircleBridge<'Evm'> {
  readonly contracts: EvmContracts;
  readonly chainId: bigint;
  readonly msgTransmitter: MessageTransmitter.MessageTransmitter;
  readonly tokenMessenger: TokenMessenger.TokenMessenger;

  private constructor(
    readonly network: 'Mainnet' | 'Testnet',
    readonly chain: EvmChainName,
    readonly provider: Provider,
  ) {
    this.contracts = new EvmContracts(network);

    this.chainId = evmNetworkChainToEvmChainId(network, chain);

    this.msgTransmitter = this.contracts.mustGetCircleMessageTransmitter(
      chain,
      provider,
    );
    this.tokenMessenger = this.contracts.mustGetCircleTokenMessenger(
      chain,
      provider,
    );
  }

  static async fromProvider(provider: Provider): Promise<EvmCircleBridge> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmCircleBridge(network, chain, provider);
  }

  async *redeem(
    sender: UniversalOrEvm,
    message: string,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);

    const txReq = await this.msgTransmitter.receiveMessage.populateTransaction(
      message,
      attestation,
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
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address.toString();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    const tokenAddr = toEvmAddrString(token.address);

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

    // TODO: config for cctpDomain
    const destinationDomain = 1;

    const txReq = await this.tokenMessenger.depositForBurn.populateTransaction(
      amount,
      destinationDomain,
      recipientAddress,
      tokenAddr,
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'CircleBridge.transfer',
    );
  }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    stackable: boolean = false,
  ): EvmUnsignedTransaction {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      stackable,
    );
  }
}
