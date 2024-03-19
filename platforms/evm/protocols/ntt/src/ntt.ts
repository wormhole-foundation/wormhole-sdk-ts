import {
  Chain,
  NttTransceiver,
  WormholeNttTransceiver,
  toChainId,
  universalAddress,
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Network,
  ProtocolInitializer,
  TokenAddress,
  UnsignedTransaction,
  VAA,
  nativeChainIds,
  tokens,
  Ntt,
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
import '@wormhole-foundation/sdk-evm-core';

import { ethers_contracts } from './index.js';

interface NttContracts {
  manager: string;
  // TODO: array of transceivers?
  // map according to attestation protocol?
  transceiver: string;
}

export function evmNttProtocolFactory(
  token: string,
): ProtocolInitializer<'Evm', 'Ntt'> {
  console.log(token);
  class _EvmNttManager<
    N extends Network,
    C extends EvmChains,
  > extends EvmNttManager<N, C> {
    tokenAddress: string = token;

    static async fromRpc<N extends Network>(
      provider: Provider,
      config: ChainsConfig<N, EvmPlatformType>,
    ): Promise<_EvmNttManager<N, EvmChains>> {
      const [network, chain] = await EvmPlatform.chainFromRpc(provider);
      const conf = config[chain]!;

      if (conf.network !== network)
        throw new Error(`Network mismatch: ${conf.network} != ${network}`);
      if (!conf.tokenMap) throw new Error('Token map not found');

      const maybeToken = tokens.filters.byAddress(conf.tokenMap, token);
      if (maybeToken === undefined) throw new Error('Token not found');
      if (!maybeToken.ntt) throw new Error('Token not configured with NTT');

      return new _EvmNttManager(network as N, chain, provider, maybeToken.ntt);
    }
  }
  return _EvmNttManager;
}

export class EvmNttWormholeTranceiver<N extends Network, C extends EvmChains>
  implements NttTransceiver<N, C, WormholeNttTransceiver.VAA>
{
  nttTransceiver: ethers_contracts.WormholeTransceiver;
  constructor(
    provider: Provider,
    readonly address: string,
  ) {
    this.nttTransceiver =
      ethers_contracts.factories.WormholeTransceiver__factory.connect(
        address,
        provider,
      );
  }

  skipRelayIx(skip: boolean): Uint8Array {
    return new Uint8Array([skip ? 1 : 0]);
  }

  receive(
    attestation: WormholeNttTransceiver.VAA,
    sender?: AccountAddress<C> | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    throw new Error('Method not implemented.');
  }
}

export abstract class EvmNttManager<N extends Network, C extends EvmChains>
  implements Ntt<N, C>
{
  abstract tokenAddress: string;
  readonly chainId: bigint;
  nttManager: ethers_contracts.NttManager;
  nttTransceiver: EvmNttWormholeTranceiver<N, C>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: NttContracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    this.nttManager = ethers_contracts.factories.NttManager__factory.connect(
      contracts.manager,
      this.provider,
    );

    this.nttTransceiver = new EvmNttWormholeTranceiver(
      provider,
      contracts.transceiver,
    );
  }

  encodeFlags(): Ntt.TransceiverInstruction[] {
    // TODO: allow selecting _which_ transceiver to use?
    const xcvr = this.nttTransceiver;
    return [
      // TODO, do we really have to specify index here or can we use the idx in
      // the array
      { index: 0, payload: xcvr.skipRelayIx(true) },
    ];
  }

  async quoteDeliveryPrice(dstChain: Chain): Promise<[bigint[], bigint]> {
    return this.nttManager.quoteDeliveryPrice.staticCall(
      toChainId(dstChain) as number,
      this.encodeFlags(),
      [this.nttTransceiver.address],
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    queue: boolean,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const [_, deliveryPrice] = await this.quoteDeliveryPrice(destination.chain);

    const transceiverIxs = Ntt.encodeTransceiverInstructions(
      this.encodeFlags(),
    );
    const senderAddress = new EvmAddress(sender).toString();

    const txReq = await this.nttManager
      .getFunction('transfer(uint256,uint16,bytes32,bool,bytes)')
      .populateTransaction(
        amount,
        toChainId(destination.chain),
        universalAddress(destination),
        queue,
        transceiverIxs,
        { value: deliveryPrice },
      );

    yield this.createUnsignedTx(addFrom(txReq, senderAddress), 'NTT.transfer');
  }

  async *redeem(
    vaa: VAA<'Ntt:WormholeTransfer'>,
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
    fromChain: Chain,
  ): Promise<Ntt.InboundQueuedTransfer | undefined> {
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
