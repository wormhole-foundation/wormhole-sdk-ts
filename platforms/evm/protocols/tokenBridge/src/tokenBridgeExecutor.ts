import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  TokenAddress,
  TokenBridge,
  TokenBridgeExecutor,
} from '@wormhole-foundation/sdk-connect';
import { nativeChainIds } from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import {
  //   EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
} from '@wormhole-foundation/sdk-evm';
import type { Provider, TransactionRequest } from 'ethers';
import { ethers_contracts } from './index.js';

import '@wormhole-foundation/sdk-evm-core';
import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';
import { SignedQuote } from '@wormhole-foundation/sdk-definitions';

export class EvmTokenBridgeExecutor<N extends Network, C extends EvmChains>
  implements TokenBridgeExecutor<N, C>
{
  readonly tokenBridge: ethers_contracts.TokenBridgeContract;
  readonly core: EvmWormholeCore<N, C>;
  readonly tokenBridgeAddress: string;
  readonly chainId: bigint;

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

    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(
        `Wormhole Token Bridge contract for domain ${chain} not found`,
      );

    this.tokenBridgeAddress = tokenBridgeAddress;
    this.tokenBridge = ethers_contracts.Bridge__factory.connect(
      this.tokenBridgeAddress,
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
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    // TODO: Implement executor transfer logic
    // This will need to:
    // 1. Encode the signed quote data
    // 2. Create a transaction that includes the executor instructions
    // 3. Use the appropriate contract method for executor transfers

    // const senderAddr = new EvmAddress(sender).toString();

    // Placeholder implementation - this will need to be updated based on the actual
    // executor contract interface and how signed quotes should be handled
    throw new Error('TokenBridgeExecutor transfer not yet implemented');
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
