import {
  ChainName,
  chainToChainId,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
  nativeDecimals,
  toChainId,
} from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  UniversalOrNative,
  AutomaticTokenBridge,
  VAA,
  serialize,
  TokenId,
  RpcConnection,
} from '@wormhole-foundation/sdk-definitions';

import { Provider, TransactionRequest } from 'ethers';

import {
  EvmChainName,
  UniversalOrEvm,
  addChainId,
  addFrom,
  addValue,
  toEvmAddrString,
} from '../types';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { TokenBridgeRelayer } from '../ethers-contracts';
import { EvmContracts } from '../contracts';

export class EvmAutomaticTokenBridge implements AutomaticTokenBridge<'Evm'> {
  readonly contracts: EvmContracts;
  readonly tokenBridgeRelayer: TokenBridgeRelayer;
  readonly chainId: bigint;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: 'Mainnet' | 'Testnet',
    readonly chain: EvmChainName,
    readonly provider: Provider,
  ) {
    this.contracts = new EvmContracts(network);

    this.chainId = evmNetworkChainToEvmChainId(network, chain);
    this.tokenBridgeRelayer = this.contracts.mustGetTokenBridgeRelayer(
      chain,
      provider,
    );
  }
  async *redeem(
    sender: UniversalOrNative<'Evm'>,
    vaa: VAA<'TransferWithPayload'>,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const txReq =
      await this.tokenBridgeRelayer.completeTransferWithRelay.populateTransaction(
        serialize(vaa),
      );

    return this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'TokenBridgeRelayer.completeTransferWithRelay',
    );
  }

  static async fromProvider(
    provider: Provider,
  ): Promise<EvmAutomaticTokenBridge> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmAutomaticTokenBridge(network, chain, provider);
  }

  //alternative naming: initiateTransfer
  async *transfer(
    sender: UniversalOrEvm,
    recipient: ChainAddress,
    token: UniversalOrEvm | 'native',
    amount: bigint,
    relayerFee: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address.toString();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    if (token === 'native') {
      const txReq =
        await this.tokenBridgeRelayer.wrapAndTransferEthWithRelay.populateTransaction(
          nativeTokenGas,
          recipientChainId,
          recipientAddress,
          0, // skip batching
          { value: relayerFee + amount + nativeTokenGas },
        );
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridgeRelayer.wrapAndTransferETHWithRelay',
      );
    } else {
      //TODO check for ERC-2612 (permit) support on token?
      const tokenAddr = toEvmAddrString(token);
      // TODO: allowance?

      const txReq =
        await this.tokenBridgeRelayer.transferTokensWithRelay.populateTransaction(
          tokenAddr,
          amount,
          nativeTokenGas,
          recipientChainId,
          recipientAddress,
          0,
        );

      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridgeRelayer.transferTokensWithRelay',
      );
    }
  }

  async getRelayerFee(
    sender: ChainAddress,
    recipient: ChainAddress,
    token: TokenId | 'native',
  ): Promise<bigint> {
    const tokenId: TokenId =
      token === 'native'
        ? await this.contracts.getNativeWrapped(sender.chain, this.provider)
        : token;

    const destChainId = toChainId(recipient.chain);
    const destTokenAddress = toEvmAddrString(tokenId.address);

    const tokenContract = this.contracts.mustGetTokenImplementation(
      this.provider,
      destTokenAddress,
    );
    const decimals = await tokenContract.decimals();

    return await this.tokenBridgeRelayer.calculateRelayerFee(
      destChainId,
      destTokenAddress,
      decimals,
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
