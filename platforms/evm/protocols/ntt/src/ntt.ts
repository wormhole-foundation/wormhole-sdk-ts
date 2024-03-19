import {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  NTT,
  Network,
  TokenAddress,
  UnsignedTransaction,
  VAA,
  nativeChainIds,
  tokens,
} from '@wormhole-foundation/sdk-connect';
import type { EvmChains, EvmPlatformType } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import type { Provider, TransactionRequest } from 'ethers';

import {
  Chain,
  toChainId,
  universalAddress,
} from '@wormhole-foundation/sdk-connect';
import '@wormhole-foundation/sdk-evm-core';
import { ethers_contracts } from './index.js';

export class EvmNtt<N extends Network, C extends EvmChains>
  implements NTT<N, C>
{
  readonly chainId: bigint;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly tokens?: tokens.ChainTokens,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;
  }

  private async getContractClients(tokenAddress: string) {
    if (!this.tokens) throw new Error('Token map not found');

    const maybeToken = tokens.filters.byAddress(this.tokens, tokenAddress);
    if (maybeToken === undefined) throw new Error('Token not found');
    if (!maybeToken.ntt) throw new Error('Token not configured with NTT');

    const { manager, transceiver } = maybeToken.ntt;

    const nttManager = ethers_contracts.factories.NttManager__factory.connect(
      manager,
      this.provider,
    );
    const nttTransceiver =
      ethers_contracts.factories.WormholeTransceiver__factory.connect(
        transceiver,
        this.provider,
      );

    return [nttManager, nttTransceiver] as [
      ethers_contracts.NttManager,
      ethers_contracts.WormholeTransceiver,
    ];
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, EvmPlatformType>,
  ): Promise<EvmNtt<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    const conf = config[chain]!;

    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmNtt<N, typeof chain>(
      network as N,
      chain,
      provider,
      conf.tokenMap,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    token: TokenAddress<C>,
    amount: bigint,
    destination: ChainAddress,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    //
    const deliveryPrice = 0n;
    const tokenAddress = token.toString();
    const [mgr, _] = await this.getContractClients(tokenAddress);

    // TODO
    const skipRelay = true;
    const payload = new Uint8Array([skipRelay ? 1 : 0]);
    const transceiverIxs = NTT.encodeTransceiverInstructions([
      { index: 0, payload },
    ]);

    const senderAddress = new EvmAddress(sender).toString();

    const txReq = await mgr
      .getFunction('transfer(uint256,uint16,bytes32,bool,bytes)')
      .populateTransaction(
        amount,
        toChainId(destination.chain),
        universalAddress(destination),
        false,
        transceiverIxs,
        { value: deliveryPrice },
      );

    yield this.createUnsignedTx(addFrom(txReq, senderAddress), 'NTT.transfer');
  }

  async *redeem(
    vaa: VAA<'NTT:WormholeTransfer'>,
    token: TokenAddress<C>,
    sender?: AccountAddress<C> | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    throw new Error('Method not implemented.');
  }

  getCurrentOutboundCapacity(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getCurrentInboundCapacity(fromChain: Chain): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getInboundQueuedTransfer(
    transceiverMessage: string,
    token: TokenAddress<C>,
    fromChain: Chain,
  ): Promise<NTT.InboundQueuedTransfer | undefined> {
    throw new Error('Method not implemented.');
  }
  completeInboundQueuedTransfer(
    transceiverMessage: string,
    token: TokenAddress<C>,
    fromChain: Chain,
    payer: string,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    parallelizable: boolean = false,
  ): EvmUnsignedTransaction<N, C> {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
