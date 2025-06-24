import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  RelayInstruction,
  TokenAddress,
  TokenBridge,
  TokenBridgeExecutor,
} from '@wormhole-foundation/sdk-connect';
import {
  nativeChainIds,
  toChainId,
  signedQuoteLayout,
  isNative,
  serializeLayout,
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
import {
  relayInstructionsLayout,
  SignedQuote,
} from '@wormhole-foundation/sdk-definitions';

const EXECUTOR_ABI = [
  'function transferTokensWithRelay(address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions) payable returns (uint64)',
  'function wrapAndTransferEthWithRelay(uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions) payable returns (uint64)',
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
    signedQuote: SignedQuote,
    estimatedCost: bigint,
    relayInstructions: RelayInstruction[],
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const targetChain = toChainId(recipient.chain);
    const targetRecipient = recipient.address
      .toUniversalAddress()
      .toUint8Array();

    const signedQuoteBytes = serializeLayout(signedQuoteLayout, signedQuote);
    const relayInstructionsBytes = serializeLayout(relayInstructionsLayout, {
      requests: relayInstructions,
    });

    const wormholeFee = await this.core.getMessageFee();

    const nonce = 0;
    const dstTransferRecipient = targetRecipient; // Same as target recipient for now
    const dstExecutionAddress = targetRecipient; // Executor address on destination
    const executionAmount = estimatedCost; // Amount for execution
    const refundAddr = senderAddr; // Refund to sender

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
    vaa: TokenBridge.TransferVAA,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    // TODO: Implement executor redeem logic
    // This should be similar to regular TokenBridge redeem but may have
    // executor-specific handling

    // const senderAddr = new EvmAddress(sender).toString();

    // Placeholder implementation
    throw new Error('TokenBridgeExecutor redeem not yet implemented');
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
