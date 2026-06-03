import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  ExecutorTokenBridge,
  Network,
  Platform,
  TokenAddress,
  TokenId,
} from '@wormhole-foundation/sdk-connect';
import {
  nativeChainIds,
  toChainId,
  signedQuoteLayout,
  isNative,
  serializeLayout,
  serialize,
  contracts,
  getExecutorTokenBridgeDestinationAddresses,
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
  'function transferTokensWithRelay(address tokenBridgeRelayer, address token, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions, tuple(uint256 transferTokenFee, uint256 nativeTokenFee, address payee) feeArgs) payable returns (uint64)',
  'function wrapAndTransferEthWithRelay(address tokenBridgeRelayer, uint256 amount, uint16 targetChain, bytes32 targetRecipient, uint32 nonce, bytes32 dstTransferRecipient, bytes32 dstExecutionAddress, uint256 executionAmount, address refundAddr, bytes calldata signedQuoteBytes, bytes calldata relayInstructions, tuple(uint256 transferTokenFee, uint256 nativeTokenFee, address payee) feeArgs) payable returns (uint64)',
];

export class EvmExecutorTokenBridge<N extends Network, C extends EvmChains>
  implements ExecutorTokenBridge<N, C>
{
  readonly chainId: bigint;
  readonly relayerAddress: string;
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

    const executorTokenBridge = this.contracts.executorTokenBridge;
    if (!executorTokenBridge)
      throw new Error(
        `Wormhole Executor Token Bridge contracts for domain ${chain} not found`,
      );

    this.relayerAddress = executorTokenBridge.relayer;

    const relayerWithReferrerAddress = executorTokenBridge.relayerWithReferrer;
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
  ): Promise<EvmExecutorTokenBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmExecutorTokenBridge(
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
    executorQuote: ExecutorTokenBridge.ExecutorQuote,
    referrerFee?: ExecutorTokenBridge.ReferrerFee,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const dstContracts = contracts.executorTokenBridge.get(
      this.network,
      recipient.chain,
    );
    if (!dstContracts || !dstContracts.relayer) {
      throw new Error(
        `Token Bridge Executor Relayer contract for domain ${recipient.chain} not found`,
      );
    }
    const dstRelayer = dstContracts.relayer;

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
    const dstAddresses = getExecutorTokenBridgeDestinationAddresses(
      this.network as 'Mainnet' | 'Testnet',
      recipient.chain,
      dstRelayer,
    );
    const dstTransferRecipient = toUniversal(recipient.chain, dstAddresses.dstTransferRecipient);
    const dstExecutionAddress = toUniversal(recipient.chain, dstAddresses.dstExecutionAddress);
    const executionAmount = estimatedCost;
    const refundAddr = senderAddr;

    let txReq: TransactionRequest;

    const referrerTransferTokenFee = referrerFee?.transferTokenFee ?? 0n;
    const referrerNativeTokenFee = referrerFee?.nativeTokenFee ?? 0n;
    const payee = referrerFee?.referrer.address.toString() ?? ZeroAddress;
    // The helper contract bridges exactly what we pass as `amount` and then
    // pulls transferTokenFee separately via _payFee. If we pass the gross
    // amount we'd double-charge the user. Pass the post-fee remainder so the
    // helper bridges the right amount; the fee transfers happen on top.
    const bridgedAmount = referrerFee?.remainingAmount ?? amount;

    if (isNative(token)) {
      // The source token is native gas, so the contract can't pull
      // transferTokenFee as ERC20 from msg.sender (no WETH approval exists).
      // Fold it into nativeTokenFee — denominated in the same units — so the
      // referrer is paid out of msg.value directly.
      const combinedNativeFee = referrerNativeTokenFee + referrerTransferTokenFee;
      const feeArgs = {
        transferTokenFee: 0n,
        nativeTokenFee: combinedNativeFee,
        payee,
      };
      txReq = await this.relayerWithReferrerContract
        .getFunction('wrapAndTransferEthWithRelay')
        .populateTransaction(
          this.relayerAddress,
          bridgedAmount,
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
            value:
              bridgedAmount + wormholeFee + executionAmount + combinedNativeFee,
          },
        );
    } else {
      const feeArgs = {
        transferTokenFee: referrerTransferTokenFee,
        nativeTokenFee: referrerNativeTokenFee,
        payee,
      };

      const tokenContract = EvmPlatform.getTokenImplementation(
        this.provider,
        token.toString(),
      );

      // Approval must cover the bridged remainder plus any ERC20-denominated
      // fee the helper contract will pull via a second safeTransferFrom.
      // Together this equals the user's original gross input amount.
      const requiredAllowance = bridgedAmount + referrerTransferTokenFee;
      const allowance = await tokenContract.allowance(
        senderAddr,
        this.relayerWithReferrerAddress,
      );

      if (allowance < requiredAllowance) {
        const txReq = await tokenContract.approve.populateTransaction(
          this.relayerWithReferrerAddress,
          requiredAllowance,
        );

        yield this.createUnsignedTx(txReq, 'approve');
      }

      txReq = await this.relayerWithReferrerContract
        .getFunction('transferTokensWithRelay')
        .populateTransaction(
          this.relayerAddress,
          token.toString(),
          bridgedAmount,
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
            value: wormholeFee + executionAmount + referrerNativeTokenFee,
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
    vaa: ExecutorTokenBridge.VAA,
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
      'ExecutorTokenBridge.executeVAAv1',
    );
  }

  async estimateMsgValueAndGasLimit(
    receivedToken: TokenId,
    recipient?: ChainAddress,
  ): Promise<{
    msgValue: bigint;
    gasLimit: bigint;
  }> {
    let gasLimit: bigint;
    switch (receivedToken.chain) {
      case 'Arbitrum':
      case 'Bsc':
      case 'MegaETH':
      case 'Monad':
      case 'Moonbeam':
        gasLimit = 1_000_000n;
        break;
      default:
        gasLimit = 650_000n;
        break;
    }

    return {
      msgValue: 0n,
      gasLimit,
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
