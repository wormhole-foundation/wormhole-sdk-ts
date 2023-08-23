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
  VAA,
  CircleBridge,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-definitions';

import { addChainId, addFrom, toEvmAddrString } from './tokenBridge';
import { EvmUnsignedTransaction } from './unsignedTransaction';
import { CircleRelayer } from './ethers-contracts';
import { Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from './contracts';
import { TokenId } from '@wormhole-foundation/connect-sdk';

//https://github.com/circlefin/evm-cctp-contracts
type EvmChain = PlatformToChainsMapping<'Evm'>;
type UniversalOrEvm = UniversalOrNative<'Evm'> | string;

export class EvmCircleBridge implements CircleBridge<'Evm'> {
  readonly contracts: EvmContracts;
  readonly circleRelayer: CircleRelayer;
  readonly chainId: bigint;

  private constructor(
    readonly network: Network,
    readonly chain: EvmChain,
    readonly provider: Provider,
  ) {
    this.contracts = new EvmContracts(network);

    this.chainId = evmNetworkChainToEvmChainId(network, chain);
    this.circleRelayer = this.contracts.mustGetWormholeCircleRelayer(
      chain,
      provider,
    );
  }

  static async fromProvider(provider: Provider): Promise<EvmCircleBridge> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmCircleBridge(network, chain, provider);
  }

  async *redeem(
    sender: UniversalOrEvm,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ): AsyncGenerator<UnsignedTransaction> {
    return;
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

    //const tokenAddr = await wh.mustGetForeignAsset(
    //  token as TokenId,
    //  sendingChain,
    //);

    //// approve
    //await chainContext.approve(
    //  sendingChain,
    //  circleRelayer.address,
    //  tokenAddr,
    //  parsedAmt,
    //);

    //console.log('About to send 2');
    //const txReq =
    //  await this.circleRelayer.transferTokensWithRelay.populateTransaction(
    //    chainContext.context.parseAddress(tokenAddr, sendingChain),
    //    parsedAmt,
    //    parsedNativeAmt,
    //    this.chainId,
    //    recipientAddress,
    //  );

    //yield this.createUnsignedTx(
    //  addFrom(txReq, senderAddr),
    //  'TokenBridgeRelayer.transferTokensWithRelay',
    //);
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
