import {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainsConfig,
  Network,
  Ntt,
  NttTransceiver,
  ProtocolInitializer,
  TokenAddress,
  UnsignedTransaction,
  WormholeNttTransceiver,
  nativeChainIds,
  toChainId,
  tokens,
  universalAddress,
} from '@wormhole-foundation/sdk-connect';
import type { EvmChains, EvmPlatformType } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import '@wormhole-foundation/sdk-evm-core';
import type { Provider, TransactionRequest } from 'ethers';

import { ethers_contracts } from './index.js';

interface NttContracts {
  manager: string;
  transceiver: {
    wormhole?: string;
  };
}

export function evmNttProtocolFactory(
  token: string,
): ProtocolInitializer<'Evm', 'Ntt'> {
  class _EvmNtt<N extends Network, C extends EvmChains> extends EvmNtt<N, C> {
    tokenAddress: string = token;

    static async fromRpc<N extends Network>(
      provider: Provider,
      config: ChainsConfig<N, EvmPlatformType>,
    ): Promise<_EvmNtt<N, EvmChains>> {
      const [network, chain] = await EvmPlatform.chainFromRpc(provider);
      const conf = config[chain]!;

      if (conf.network !== network)
        throw new Error(`Network mismatch: ${conf.network} != ${network}`);
      if (!conf.tokenMap) throw new Error('Token map not found');

      const maybeToken = tokens.filters.byAddress(conf.tokenMap, token);
      if (maybeToken === undefined) throw new Error('Token not found');
      if (!maybeToken.ntt) throw new Error('Token not configured with NTT');

      const { manager, transceiver } = maybeToken.ntt;
      return new _EvmNtt(network as N, chain, provider, {
        manager,
        transceiver: { wormhole: transceiver },
      });
    }
  }
  return _EvmNtt;
}

export class EvmNttWormholeTranceiver<N extends Network, C extends EvmChains>
  implements NttTransceiver<N, C, WormholeNttTransceiver.VAA>
{
  nttTransceiver: ethers_contracts.WormholeTransceiver;
  constructor(
    readonly address: string,
    provider: Provider,
  ) {
    this.nttTransceiver =
      ethers_contracts.factories.WormholeTransceiver__factory.connect(
        address,
        provider,
      );
  }

  encodeFlags(skipRelay: boolean): Uint8Array {
    return new Uint8Array([skipRelay ? 1 : 0]);
  }

  receive(
    attestation: WormholeNttTransceiver.VAA,
    sender?: AccountAddress<C> | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    throw new Error('Method not implemented.');
  }
}

export abstract class EvmNtt<N extends Network, C extends EvmChains>
  implements Ntt<N, C>
{
  abstract tokenAddress: string;
  readonly chainId: bigint;
  manager: ethers_contracts.NttManager;
  xcvrs: EvmNttWormholeTranceiver<N, C>[];
  managerAddress: string;

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

    this.managerAddress = contracts.manager;
    this.manager = ethers_contracts.factories.NttManager__factory.connect(
      contracts.manager,
      this.provider,
    );

    this.xcvrs = [
      // Enable more Transceivers here
      new EvmNttWormholeTranceiver(
        contracts.transceiver.wormhole!,
        this.provider,
      ),
    ];
  }

  private encodeFlags(enabledIdxs?: number[]): Ntt.TransceiverInstruction[] {
    return this.xcvrs
      .map((xcvr, idx) => {
        if (!enabledIdxs || enabledIdxs.includes(idx))
          return { index: idx, payload: xcvr.encodeFlags(true) };
        return null;
      })
      .filter((x) => x !== null) as Ntt.TransceiverInstruction[];
  }

  async quoteDeliveryPrice(dstChain: Chain): Promise<[bigint[], bigint]> {
    return this.manager.quoteDeliveryPrice.staticCall(
      toChainId(dstChain),
      this.encodeFlags(),
      this.xcvrs.map((x) => x.address),
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    queue: boolean,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const [_, totalPrice] = await this.quoteDeliveryPrice(destination.chain);
    const transceiverIxs = Ntt.encodeTransceiverInstructions(
      this.encodeFlags(),
    );
    const senderAddress = new EvmAddress(sender).toString();

    //TODO check for ERC-2612 (permit) support on token?
    const tokenContract = EvmPlatform.getTokenImplementation(
      this.provider,
      this.tokenAddress,
    );

    const allowance = await tokenContract.allowance(
      senderAddress,
      this.managerAddress,
    );
    if (allowance < amount) {
      const txReq = await tokenContract.approve.populateTransaction(
        this.managerAddress,
        amount,
      );
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddress),
        'TokenBridge.Approve',
      );
    }

    const txReq = await this.manager
      .getFunction('transfer(uint256,uint16,bytes32,bool,bytes)')
      .populateTransaction(
        amount,
        toChainId(destination.chain),
        universalAddress(destination),
        queue,
        transceiverIxs,
        { value: totalPrice },
      );

    yield this.createUnsignedTx(addFrom(txReq, senderAddress), 'Ntt.transfer');
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
