import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  TokenAddress,
} from '@wormhole-foundation/sdk-connect';
import { TbtcBridge, nativeChainIds } from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import type { Provider, TransactionRequest } from 'ethers';
import { Contract, keccak256 } from 'ethers';

import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';
import { EvmTokenBridge } from '@wormhole-foundation/sdk-evm-tokenbridge';

import '@wormhole-foundation/sdk-evm-tokenbridge';

export class EvmTbtcBridge<N extends Network, C extends EvmChains = EvmChains>
  implements TbtcBridge<N, C>
{
  chainId: bigint;

  core: EvmWormholeCore<N, C>;

  tokenBridge: EvmTokenBridge<N, C>;

  // Only some chains have a Tbtc gateway contract
  gatewayAddress?: string;
  gateway?: Contract;

  tbtcToken: TokenAddress<C>;

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

    this.core = new EvmWormholeCore(network, chain, provider, contracts);

    this.tokenBridge = new EvmTokenBridge(network, chain, provider, contracts);

    this.gatewayAddress = this.contracts.tbtc;
    if (this.gatewayAddress) {
      this.gateway = new Contract(
        this.gatewayAddress,
        [
          'function sendTbtc(uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64)',
          'function receiveTbtc(bytes calldata encodedVm)',
        ],
        provider,
      );
    }

    this.tbtcToken = contracts.tbtcToken!;
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmTbtcBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmTbtcBridge(network as N, chain, provider, conf.contracts);
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    toGateway?: ChainAddress,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddress = new EvmAddress(sender).toString();

    // TODO: normalize amount

    /**
     * There are four cases to consider:
     * 1. Gateway -> Gateway: sendTbtc, receiveTbtc
     * 2. Gateway -> Non-Gateway: sendTbtc, tokenBridge.receive
     * 3. Non-Gateway -> Gateway: transfer
     * 4. Non-Gateway -> Non-Gateway:
     */

    const fromGateway = this.gateway;

    if (fromGateway) {
      const nonce = new Date().valueOf() % 2 ** 4;

      const tx = await fromGateway.sendTbtc!.populateTransaction(
        amount,
        recipient.chain,
        recipient.address.toUniversalAddress(),
        0n,
        nonce,
      );
      tx.value = await this.core.getMessageFee();

      yield* this.approve(
        token.toString(),
        senderAddress,
        amount,
        this.gatewayAddress!,
      );

      yield this.createUnsignedTransaction(
        addFrom(tx, senderAddress),
        'TbtcBridge.Send',
      );
      return;
    }

    if (toGateway) {
      yield* this.tokenBridge.transfer(
        sender,
        toGateway,
        token,
        amount,
        recipient.address.toUniversalAddress().toUint8Array(),
      );
      return;
    }

    yield* this.tokenBridge.transfer(sender, recipient, token, amount);
  }

  async *redeem(sender: AccountAddress<C>, vaa: TbtcBridge.VAA) {
    const address = new EvmAddress(sender).toString();

    if (this.gateway) {
      const tx = await this.gateway.receiveTbtc!.populateTransaction(vaa);

      yield this.createUnsignedTransaction(
        addFrom(tx, address),
        'TbtcBridge.Redeem',
      );
    } else {
      // yield *this.tokenBridge.redeem(sender, vaa);
    }

    //yield this.createUnsignedTransaction(
    //  addFrom(txReq, address),
    //  'TbtcBridge.Redeem',
    //);
  }

  async isTransferCompleted(vaa: TbtcBridge.VAA): Promise<boolean> {
    const isCompleted = await this.tokenBridge.tokenBridge.isTransferCompleted(
      keccak256(vaa.hash),
    );
    return isCompleted;
  }

  private async *approve(
    token: string,
    senderAddr: string,
    amount: bigint,
    contract: string,
  ) {
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
        'Tbtc.Approve',
      );
    }
  }

  private createUnsignedTransaction(
    txReq: TransactionRequest,
    description: string,
  ) {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      false,
    );
  }
}
