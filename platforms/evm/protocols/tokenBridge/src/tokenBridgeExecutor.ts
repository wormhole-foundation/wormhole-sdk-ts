import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  TokenAddress,
  TokenBridgeExecutor,
} from '@wormhole-foundation/sdk-connect';
import {
  nativeChainIds,
  toChainId,
  signedQuoteLayout,
  isNative,
  serializeLayout,
  serialize,
} from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import type { Provider, TransactionRequest } from 'ethers';
import { Contract } from 'ethers';
import '@wormhole-foundation/sdk-evm-core';
import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';
import { relayInstructionsLayout } from '@wormhole-foundation/sdk-definitions';
import { contracts } from '@wormhole-foundation/sdk-connect';

const EXECUTOR_ABI = [
  'function transferTokensWithRelay(address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions) payable returns (uint64)',
  'function wrapAndTransferEthWithRelay(uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions) payable returns (uint64)',
  'function executeVAAv1(bytes calldata encodedTransferMessage) payable',
];

export class EvmTokenBridgeExecutor<N extends Network, C extends EvmChains>
  implements TokenBridgeExecutor<N, C>
{
  readonly chainId: bigint;
  readonly executorAddress: string;
  readonly executorContract: Contract;
  readonly core: EvmWormholeCore<N, C>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    const executorAddress = this.contracts.tokenBridgeExecutor;
    if (!executorAddress)
      throw new Error(
        `Wormhole Token Bridge Executor contract for domain ${chain} not found`,
      );

    this.executorAddress = executorAddress;
    this.executorContract = new Contract(
      this.executorAddress,
      EXECUTOR_ABI,
      provider,
    );

    this.core = new EvmWormholeCore(network, chain, provider, contracts);
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmTokenBridgeExecutor<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmTokenBridgeExecutor(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    executorQuote: TokenBridgeExecutor.ExecutorQuote,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const targetChain = toChainId(recipient.chain);
    const targetRecipient = recipient.address
      .toUniversalAddress()
      .toUint8Array();

    const { estimatedCost, signedQuote, relayInstructions } = executorQuote;

    const signedQuoteBytes = serializeLayout(signedQuoteLayout, signedQuote);
    const relayInstructionsBytes = serializeLayout(
      relayInstructionsLayout,
      relayInstructions,
    );

    const wormholeFee = await this.core.getMessageFee();

    const nonce = 0;
    const dstExecutorAddress = contracts.tokenBridgeExecutor.get(
      this.network,
      recipient.chain,
    );
    if (!dstExecutorAddress) {
      throw new Error(
        `Token Bridge Executor contract for domain ${recipient.chain} not found`,
      );
    }
    const dstTransferRecipient = new EvmAddress(dstExecutorAddress)
      .toUniversalAddress()
      .toUint8Array();
    const dstExecutionAddress = dstTransferRecipient;
    const executionAmount = estimatedCost;
    const refundAddr = senderAddr;

    let txReq: TransactionRequest;

    if (isNative(token)) {
      txReq = await this.executorContract
        .getFunction('wrapAndTransferEthWithRelay')
        .populateTransaction(
          targetChain,
          targetRecipient,
          nonce,
          dstTransferRecipient,
          dstExecutionAddress,
          executionAmount,
          refundAddr,
          signedQuoteBytes,
          relayInstructionsBytes,
          {
            value: amount + wormholeFee + executionAmount,
          },
        );
    } else {
      const tokenContract = EvmPlatform.getTokenImplementation(
        this.provider,
        token.toString(),
      );

      const allowance = await tokenContract.allowance(
        senderAddr,
        this.executorAddress,
      );

      if (allowance < amount) {
        const txReq = await tokenContract.approve.populateTransaction(
          this.executorAddress,
          amount,
        );

        yield this.createUnsignedTx(txReq, 'approve');
      }

      txReq = await this.executorContract
        .getFunction('transferTokensWithRelay')
        .populateTransaction(
          token.toString(),
          amount,
          targetChain,
          targetRecipient,
          nonce,
          dstTransferRecipient,
          dstExecutionAddress,
          executionAmount,
          refundAddr,
          signedQuoteBytes,
          relayInstructionsBytes,
          {
            value: wormholeFee + executionAmount,
          },
        );
    }

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      isNative(token)
        ? 'wrapAndTransferEthWithRelay'
        : 'transferTokensWithRelay',
    );
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridgeExecutor.VAA,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();

    const encodedTransferMessage = serialize(vaa);

    const dstExecutorAddress = new EvmAddress(
      vaa.payload.to.address,
    ).toString();

    const dstExecutorContract = new Contract(
      dstExecutorAddress,
      EXECUTOR_ABI,
      this.provider,
    );

    const txReq = await dstExecutorContract
      .getFunction('executeVAAv1')
      .populateTransaction(encodedTransferMessage, {
        value: 0n,
      });

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'TokenBridgeExecutor.executeVAAv1',
    );
  }

  async estimateMsgValueAndGasLimit(recipient?: ChainAddress): Promise<{
    msgValue: bigint;
    gasLimit: bigint;
  }> {
    // TODO: Implement gas estimation logic
    // This should calculate the estimated cost for executor transactions
    // based on the recipient and current network conditions

    // Placeholder values - these should be calculated based on actual requirements
    return {
      msgValue: 0n,
      gasLimit: 500_000n,
    };
  }

  createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
  ): EvmUnsignedTransaction<N, C> {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
    );
  }
}
