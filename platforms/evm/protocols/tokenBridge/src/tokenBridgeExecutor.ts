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
  contracts,
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
  toUniversal,
} from '@wormhole-foundation/sdk-definitions';
import { ZeroAddress } from 'ethers';

const RELAYER_ABI = [
  'function transferTokensWithRelay(address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions) payable returns (uint64)',
  'function wrapAndTransferEthWithRelay(uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions) payable returns (uint64)',
  'function executeVAAv1(bytes calldata encodedTransferMessage) payable',
];

const RELAYER_WITH_REFERRER_ABI = [
  'function transferTokensWithRelay(address tokenBridgeRelayer, address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions, tuple(address payee, uint16 dbps) feeArgs) payable returns (uint64)',
  'function wrapAndTransferEthWithRelay(address tokenBridgeRelayer, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions, tuple(address payee, uint16 dbps) feeArgs) payable returns (uint64)',
];

export class EvmTokenBridgeExecutor<N extends Network, C extends EvmChains>
  implements TokenBridgeExecutor<N, C>
{
  readonly chainId: bigint;
  readonly relayerWithReferrerAddress: string;
  readonly relayerWithReferrerContract: Contract;
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

    const tokenBridgeExecutor = this.contracts.tokenBridgeExecutor;
    if (!tokenBridgeExecutor)
      throw new Error(
        `Wormhole Token Bridge Executor contracts for domain ${chain} not found`,
      );

    const relayerWithReferrerAddress = tokenBridgeExecutor.relayerWithReferrer;
    if (!relayerWithReferrerAddress)
      throw new Error(
        `Wormhole Token Bridge Relayer With Referrer contract for domain ${chain} not found`,
      );

    this.relayerWithReferrerAddress = relayerWithReferrerAddress;
    this.relayerWithReferrerContract = new Contract(
      this.relayerWithReferrerAddress,
      RELAYER_WITH_REFERRER_ABI,
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
    referrerFee?: TokenBridgeExecutor.ReferrerFee,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const dstExecutor = contracts.tokenBridgeExecutor.get(
      this.network,
      recipient.chain,
    );
    if (!dstExecutor || !dstExecutor.relayer) {
      throw new Error(
        `Token Bridge Executor Relayer contract for domain ${recipient.chain} not found`,
      );
    }
    const dstRelayer = dstExecutor.relayer;

    const senderAddr = new EvmAddress(sender).unwrap();
    const targetChain = toChainId(recipient.chain);
    const targetRecipient = recipient.address.toUniversalAddress();

    const { estimatedCost, signedQuote, relayInstructions } = executorQuote;

    const signedQuoteBytes = serializeLayout(signedQuoteLayout, signedQuote);
    const relayInstructionsBytes = serializeLayout(
      relayInstructionsLayout,
      relayInstructions,
    );

    const wormholeFee = await this.core.getMessageFee();

    const nonce = 0;
    const dstTransferRecipient = toUniversal(recipient.chain, dstRelayer);
    const dstExecutionAddress = dstTransferRecipient;
    const executionAmount = estimatedCost;
    const refundAddr = senderAddr;

    let txReq: TransactionRequest;

    // TODO: this could be optimized to use the non-referrer contract if referrerFee is not provided
    const feeArgs = referrerFee
      ? {
          payee: referrerFee.referrer.address.toString(),
          dbps: referrerFee.feeDbps,
        }
      : {
          payee: ZeroAddress,
          dbps: 0n,
        };

    if (isNative(token)) {
      txReq = await this.relayerWithReferrerContract
        .getFunction('wrapAndTransferEthWithRelay')
        .populateTransaction(
          this.relayerWithReferrerAddress,
          amount,
          targetChain,
          targetRecipient.toUint8Array(),
          nonce,
          dstTransferRecipient.toUint8Array(),
          dstExecutionAddress.toUint8Array(),
          executionAmount,
          refundAddr,
          signedQuoteBytes,
          relayInstructionsBytes,
          feeArgs,
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
        this.relayerWithReferrerAddress,
      );

      if (allowance < amount) {
        const txReq = await tokenContract.approve.populateTransaction(
          this.relayerWithReferrerAddress,
          amount,
        );

        yield this.createUnsignedTx(txReq, 'approve');
      }

      txReq = await this.relayerWithReferrerContract
        .getFunction('transferTokensWithRelay')
        .populateTransaction(
          this.relayerWithReferrerAddress,
          token.toString(),
          amount,
          targetChain,
          targetRecipient.toUint8Array(),
          nonce,
          dstTransferRecipient.toUint8Array(),
          dstExecutionAddress.toUint8Array(),
          executionAmount,
          refundAddr,
          signedQuoteBytes,
          relayInstructionsBytes,
          feeArgs,
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

    const dstRelayerAddress = new EvmAddress(vaa.payload.to.address).toString();

    const dstRelayerContract = new Contract(
      dstRelayerAddress,
      RELAYER_ABI,
      this.provider,
    );

    const txReq = await dstRelayerContract
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
      gasLimit: 0n,
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
