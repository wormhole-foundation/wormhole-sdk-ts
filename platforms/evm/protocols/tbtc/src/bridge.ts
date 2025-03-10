import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
} from '@wormhole-foundation/sdk-connect';
import { TBTCBridge, nativeChainIds } from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import { toChainId } from '@wormhole-foundation/sdk-base';
import {
  canonicalAddress,
  serialize,
} from '@wormhole-foundation/sdk-definitions';
import { Contract, Provider, TransactionRequest } from 'ethers';

import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';

export class EvmTBTCBridge<N extends Network, C extends EvmChains = EvmChains>
  implements TBTCBridge<N, C>
{
  chainId: bigint;

  core: EvmWormholeCore<N, C>;

  gatewayAddress: string;
  gateway: Contract;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (this.network !== 'Mainnet') {
      throw new Error('TBTC is only supported on Mainnet');
    }

    if (!this.contracts.tbtc) {
      throw new Error('TBTC contract address is required');
    }

    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    this.core = new EvmWormholeCore(network, chain, provider, contracts);

    this.gatewayAddress = this.contracts.tbtc;

    this.gateway = new Contract(
      this.gatewayAddress,
      [
        'function sendTbtc(uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64)',
        'function receiveTbtc(bytes calldata encodedVm)',
      ],
      provider,
    );
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmTBTCBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmTBTCBridge(network as N, chain, provider, conf.contracts);
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddress = new EvmAddress(sender).toString();

    const tbtcToken = TBTCBridge.getNativeTbtcToken(this.chain);
    if (!tbtcToken) {
      throw new Error('Native tbtc token not found');
    }

    const tx = await this.gateway.sendTbtc!.populateTransaction(
      amount,
      toChainId(recipient.chain),
      recipient.address.toUniversalAddress().toUint8Array(),
      0n,
      0n,
    );
    tx.value = await this.core.getMessageFee();

    yield* this.approve(
      canonicalAddress(tbtcToken),
      senderAddress,
      amount,
      this.gatewayAddress,
    );

    yield this.createUnsignedTransaction(
      addFrom(tx, senderAddress),
      'TBTCBridge.Send',
    );
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TBTCBridge.VAA,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const address = new EvmAddress(sender).toString();

    const tx = await this.gateway.receiveTbtc!.populateTransaction(
      serialize(vaa),
    );

    yield this.createUnsignedTransaction(
      addFrom(tx, address),
      'TBTCBridge.Redeem',
    );
  }

  private async *approve(
    token: string,
    senderAddr: string,
    amount: bigint,
    contract: string,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const tokenContract = EvmPlatform.getTokenImplementation(
      this.provider,
      token,
    );
    const allowance = await tokenContract.allowance(senderAddr, contract);
    if (allowance < amount) {
      const txReq = await tokenContract.approve.populateTransaction(
        contract,
        amount,
      );
      yield this.createUnsignedTransaction(
        addFrom(txReq, senderAddr),
        'TBTC.Approve',
      );
    }
  }

  private createUnsignedTransaction(
    txReq: TransactionRequest,
    description: string,
  ): EvmUnsignedTransaction<N, C> {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      false,
    );
  }
}
