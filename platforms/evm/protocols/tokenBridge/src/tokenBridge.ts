import {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  ErrNotWrapped,
  NativeAddress,
  Network,
  TokenAddress,
  TokenBridge,
  TokenId,
  UniversalAddress,
  keccak256,
  serialize,
  toChain,
  toChainId,
  Chain,
  Platform,
  nativeChainIds,
  toNative,
} from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';

import { ethers_contracts } from '.';
import { TokenBridgeContract } from './ethers-contracts';

import {
  EvmAddress,
  EvmChains,
  EvmPlatform,
  EvmPlatformType,
  EvmUnsignedTransaction,
  EvmZeroAddress,
  addChainId,
  addFrom,
  unusedArbiterFee,
  unusedNonce,
} from '@wormhole-foundation/connect-sdk-evm';

import '@wormhole-foundation/connect-sdk-evm-core';

export class EvmTokenBridge<N extends Network, C extends EvmChains>
  implements TokenBridge<N, EvmPlatformType, C>
{
  readonly tokenBridge: TokenBridgeContract;
  readonly tokenBridgeAddress: string;
  readonly chainId: bigint;

  private constructor(
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
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmTokenBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmTokenBridge(network as N, chain, provider, conf.contracts);
  }

  async isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    return await this.tokenBridge.isWrappedAsset(token.toString());
  }

  async getOriginalAsset(token: TokenAddress<C>): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token)))
      throw ErrNotWrapped(token.toString());

    const tokenContract = EvmPlatform.getTokenImplementation(
      this.provider,
      token.toString(),
    );

    const [chain, address] = await Promise.all([
      tokenContract.chainId().then(Number).then(toChainId).then(toChain),
      tokenContract.nativeContract().then((addr) => new UniversalAddress(addr)),
    ]);
    return { chain, address };
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (e) {}
    return false;
  }

  async getWrappedAsset(token: TokenId<Chain>): Promise<NativeAddress<C>> {
    const wrappedAddress = await this.tokenBridge.wrappedAsset(
      toChainId(token.chain),
      token.address.toUniversalAddress().toString(),
    );

    if (wrappedAddress === EvmZeroAddress)
      throw ErrNotWrapped(token.address.toUniversalAddress().toString());

    return new EvmAddress(wrappedAddress) as NativeAddress<C>;
  }

  async isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    //The double keccak here is neccessary due to a fuckup in the original implementation of the
    //  EVM core bridge:
    //Guardians don't sign messages (bodies) but explicitly hash them via keccak256 first.
    //However, they use an ECDSA scheme for signing where the first step is to hash the "message"
    //  (which at this point is already the digest of the original message/body!)
    //Now, on EVM, ecrecover expects the final digest (i.e. a bytes32 rather than a dynamic bytes)
    //  i.e. it does no hashing itself. Therefore the EVM core bridge has to hash the body twice
    //  before calling ecrecover. But in the process of doing so, it erroneously sets the doubly
    //  hashed value as vm.hash instead of using the only once hashed value.
    //And finally this double digest is then used in a mapping to store whether a VAA has already
    //  been redeemed or not, which is ultimately the reason why we have to keccak the hash one
    //  more time here.
    return this.tokenBridge.isTransferCompleted(keccak256(vaa.hash));
  }

  async *createAttestation(
    token: TokenAddress<C>,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const ignoredNonce = 0;
    yield this.createUnsignedTx(
      await this.tokenBridge.attestToken.populateTransaction(
        token.toString(),
        ignoredNonce,
      ),
      'TokenBridge.createAttestation',
    );
  }

  async *submitAttestation(
    vaa: TokenBridge.AttestVAA,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const func = (await this.hasWrappedAsset({
      ...vaa.payload.token,
    }))
      ? 'updateWrapped'
      : 'createWrapped';
    yield this.createUnsignedTx(
      await this.tokenBridge[func].populateTransaction(serialize(vaa)),
      'TokenBridge.' + func,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const recipientChainId = toChainId(recipient.chain);
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();

    if (token === 'native') {
      const txReq = await (payload === undefined
        ? this.tokenBridge.wrapAndTransferETH.populateTransaction(
            recipientChainId,
            recipientAddress,
            unusedArbiterFee,
            unusedNonce,
            { value: amount },
          )
        : this.tokenBridge.wrapAndTransferETHWithPayload.populateTransaction(
            recipientChainId,
            recipientAddress,
            unusedNonce,
            payload,
            { value: amount },
          ));

      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridge.wrapAndTransferETH' +
          (payload === undefined ? '' : 'WithPayload'),
      );
    } else {
      //TODO check for ERC-2612 (permit) support on token?
      const tokenAddr = new EvmAddress(token).toString();
      const tokenContract = EvmPlatform.getTokenImplementation(
        this.provider,
        tokenAddr,
      );

      const allowance = await tokenContract.allowance(
        senderAddr,
        this.tokenBridge.target,
      );
      if (allowance < amount) {
        const txReq = await tokenContract.approve.populateTransaction(
          this.tokenBridge.target,
          amount,
        );
        yield this.createUnsignedTx(
          addFrom(txReq, senderAddr),
          'TokenBridge.Approve',
        );
      }
      const sharedParams = [
        tokenAddr,
        amount,
        recipientChainId,
        recipientAddress,
      ] as const;
      const txReq = await (payload === undefined
        ? this.tokenBridge.transferTokens.populateTransaction(
            ...sharedParams,
            unusedArbiterFee,
            unusedNonce,
          )
        : this.tokenBridge.transferTokensWithPayload.populateTransaction(
            ...sharedParams,
            unusedNonce,
            payload,
          ));
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridge.transferTokens' +
          (payload === undefined ? '' : 'WithPayload'),
      );
    }
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.TransferVAA,
    unwrapNative: boolean = true,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    if (
      vaa.payloadName === 'TransferWithPayload' &&
      vaa.payload.token.chain !== this.chain
    ) {
      const fromAddr = new EvmAddress(vaa.payload.from).unwrap();
      if (fromAddr !== senderAddr)
        throw new Error(
          `VAA.from (${fromAddr}) does not match sender (${senderAddr})`,
        );
    }

    const wrappedNativeAddr = await this.tokenBridge.WETH();
    const tokenAddr = new EvmAddress(vaa.payload.token.address).unwrap();
    if (tokenAddr === wrappedNativeAddr && unwrapNative) {
      const txReq =
        await this.tokenBridge.completeTransferAndUnwrapETH.populateTransaction(
          serialize(vaa),
        );
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridge.completeTransferAndUnwrapETH',
      );
    } else {
      const txReq = await this.tokenBridge.completeTransfer.populateTransaction(
        serialize(vaa),
      );
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridge.completeTransfer',
      );
    }
  }

  async getWrappedNative() {
    const address = await this.tokenBridge.WETH();
    return toNative(this.chain, address);
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
