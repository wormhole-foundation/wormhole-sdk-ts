import {
  toChainId,
  chainToChainId,
  chainIdToChain,
  Network,
  PlatformToChainsMapping,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
} from '@wormhole-foundation/sdk-base';
import {
  VAA,
  serialize,
  UniversalAddress,
  ChainAddress,
  UniversalOrNative,
  TokenBridge,
  keccak256,
} from '@wormhole-foundation/sdk-definitions';

import { EvmAddress } from './address';
import { EvmUnsignedTransaction } from './unsignedTransaction';
import {
  TokenBridgeContract,
  TokenImplementation__factory as TokenContractFactory,
} from './ethers-contracts';
import { Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from './contracts';

type EvmChain = PlatformToChainsMapping<'Evm'>;
type UniversalOrEvm = UniversalOrNative<'Evm'> | string;

const toEvmAddrString = (addr: UniversalOrEvm) =>
  typeof addr === 'string'
    ? addr
    : (addr instanceof UniversalAddress ? addr.toNative('Evm') : addr).unwrap();

const addFrom = (txReq: TransactionRequest, from: string) => ({
  ...txReq,
  from,
});
const addChainId = (txReq: TransactionRequest, chainId: bigint) => ({
  ...txReq,
  chainId,
});
const unusedNonce = 0;
const unusedArbiterFee = 0n;

//a word on casts here:
//  Typescript only properly resolves types when EvmTokenBridge is fully instantiated. Until such a
//    time, it does not realize that e.g. NativeAddress<C> equals EvmAddress and hence we have to
//    to cast (from our POV) entirely unnecessarily.
//Currently the code does not consider Wormhole msg fee (because it is and always has been 0).
//TODO more checks to determine that all necessary preconditions are met (e.g. that balances are
//  sufficient) for a given transaction to succeed
export class EvmTokenBridge implements TokenBridge<'Evm'> {
  readonly contracts: EvmContracts;
  readonly tokenBridge: TokenBridgeContract;
  readonly chainId: bigint;

  private constructor(
    readonly network: Network,
    readonly chain: EvmChain,
    readonly provider: Provider,
  ) {
    this.contracts = new EvmContracts(network);

    this.chainId = evmNetworkChainToEvmChainId(network, chain);
    this.tokenBridge = this.contracts.mustGetTokenBridge(chain, provider);
  }

  static async fromProvider(provider: Provider): Promise<EvmTokenBridge> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmTokenBridge(network, chain, provider);
  }

  async isWrappedAsset(token: UniversalOrEvm): Promise<boolean> {
    return this.tokenBridge.isWrappedAsset(toEvmAddrString(token));
  }

  async getOriginalAsset(token: UniversalOrEvm): Promise<ChainAddress> {
    if (!(await this.isWrappedAsset(token)))
      throw new Error(`Token ${token} is not a wrapped asset`);

    const tokenContract = TokenContractFactory.connect(
      toEvmAddrString(token),
      this.provider,
    );
    const [chain, address] = await Promise.all([
      tokenContract.chainId().then(Number).then(toChainId).then(chainIdToChain),
      tokenContract.nativeContract().then((addr) => new UniversalAddress(addr)),
    ]);
    return { chain, address };
  }

  async hasWrappedAsset({ chain, address }: ChainAddress): Promise<boolean> {
    try {
      //TODO it's unclear to me why this would throw for a non-existent token but that's how the
      //  old sdk checked for existence
      await this.getWrappedAsset({ chain, address });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getWrappedAsset({ chain, address }: ChainAddress): Promise<EvmAddress> {
    return new EvmAddress(
      await this.tokenBridge.wrappedAsset(chain, address.toString()),
    );
  }

  async isTransferCompleted(
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ): Promise<boolean> {
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

  //TODO bestEffortFindRedemptionTx()

  async *createAttestation(
    token: UniversalOrEvm,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const ignoredNonce = 0;
    yield this.createUnsignedTx(
      await this.tokenBridge.attestToken.populateTransaction(
        toEvmAddrString(token),
        ignoredNonce,
      ),
      'TokenBridge.createAttestation',
    );
  }

  async *submitAttestation(
    vaa: VAA<'AttestMeta'>,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    // TODO: fix
    // const func = (await this.hasWrappedAsset({
    //   ...vaa.payload.token,
    // }))
    //   ? 'createWrapped'
    //   : 'updateWrapped';
    // yield this.createUnsignedTx(
    //   await this.tokenBridge[func].populateTransaction(serialize(vaa)),
    //   'TokenBridge.' + func,
    // );
  }

  //alternative naming: initiateTransfer
  async *transfer(
    sender: UniversalOrEvm,
    recipient: ChainAddress,
    token: UniversalOrEvm | 'native',
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address.toString();
    if (typeof token === 'string' && token === 'native') {
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
      const tokenAddr = toEvmAddrString(token);
      const tokenContract = TokenContractFactory.connect(
        tokenAddr,
        this.provider,
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
          'ERC20.approve of TokenBridge',
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

  //alternative naming: completeTransfer
  async *redeem(
    sender: UniversalOrEvm,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative: boolean = true,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    if (vaa.payload.token.chain !== this.chain)
      if (vaa.payloadLiteral === 'TransferWithPayload') {
        const fromAddr = vaa.payload.from.toNative('Evm').unwrap();
        if (fromAddr !== senderAddr)
          throw new Error(
            `VAA.from (${fromAddr}) does not match sender (${senderAddr})`,
          );
      }
    const wrappedNativeAddr = await this.tokenBridge.WETH();
    const tokenAddr = vaa.payload.token.address.toNative('Evm').unwrap();
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

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    stackable: boolean = false,
  ): EvmUnsignedTransaction {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      stackable,
    );
  }
}
