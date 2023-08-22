import {
  chainToChainId,
  Network,
  PlatformToChainsMapping,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
} from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  UniversalOrNative,
  AutomaticTokenBridge,
  UnsignedTransaction,
  VAA,
  serialize,
} from '@wormhole-foundation/sdk-definitions';

import { addChainId, addFrom, toEvmAddrString } from './tokenBridge';
import { EvmUnsignedTransaction } from './unsignedTransaction';
import { TokenBridgeRelayer } from './ethers-contracts';
import { Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from './contracts';

type EvmChain = PlatformToChainsMapping<'Evm'>;
type UniversalOrEvm = UniversalOrNative<'Evm'> | string;

export class EvmAutomaticTokenBridge implements AutomaticTokenBridge<'Evm'> {
  readonly contracts: EvmContracts;
  readonly tokenBridgeRelayer: TokenBridgeRelayer;
  readonly chainId: bigint;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: Network,
    readonly chain: EvmChain,
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
    const networkChainPair = evmChainIdToNetworkChainPair(chainId);
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
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address.toString();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;
    if (typeof token === 'string' && token === 'native') {
      const txReq =
        await this.tokenBridgeRelayer.wrapAndTransferEthWithRelay.populateTransaction(
          nativeTokenGas,
          recipientChainId,
          recipientAddress,
          0,
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
