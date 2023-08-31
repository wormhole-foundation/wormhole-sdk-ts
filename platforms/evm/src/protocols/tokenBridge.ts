import {
  toChainId,
  chainToChainId,
  chainIdToChain,
  Network,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
  toChainName,
} from '@wormhole-foundation/sdk-base';
import {
  VAA,
  serialize,
  UniversalAddress,
  ChainAddress,
  TokenBridge,
  TxHash,
  keccak256,
  TokenId,
} from '@wormhole-foundation/sdk-definitions';
import { TokenTransferTransaction } from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';

import {
  TokenBridgeContract,
  TokenImplementation__factory as TokenContractFactory,
} from '../ethers-contracts';
import { BridgeStructs } from '../ethers-contracts/Bridge';

import { EvmAddress } from '../address';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { EvmContracts } from '../contracts';
import {
  EvmChainName,
  UniversalOrEvm,
  addFrom,
  addChainId,
  toEvmAddrString,
  unusedArbiterFee,
  unusedNonce,
} from '../types';

//a word on casts here:
//  Typescript only properly resolves types when EvmTokenBridge is fully instantiated. Until such a
//    time, it does not realize that e.g. NativeAddress<C> equals EvmAddress and hence we have to
//    to cast (from our POV) entirely unnecessarily.
//Currently the code does not consider Wormhole msg fee (because it is and always has been 0).
//TODO more checks to determine that all necessary preconditions are met (e.g. that balances are
//  sufficient) for a given transaction to succeed
export class EvmTokenBridge implements TokenBridge<'Evm'> {
  readonly tokenBridge: TokenBridgeContract;
  readonly chainId: bigint;

  private constructor(
    readonly network: Network,
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: EvmContracts,
  ) {
    this.chainId = evmNetworkChainToEvmChainId.get(network, chain)!;
    this.tokenBridge = this.contracts.mustGetTokenBridge(chain, provider);
  }

  static async fromProvider(
    provider: Provider,
    contracts: EvmContracts,
  ): Promise<EvmTokenBridge> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmTokenBridge(network, chain, provider, contracts);
  }

  async isWrappedAsset(token: UniversalOrEvm): Promise<boolean> {
    return this.tokenBridge.isWrappedAsset(toEvmAddrString(token));
  }

  async getOriginalAsset(token: UniversalOrEvm): Promise<TokenId> {
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

  // TODO:
  // @ts-ignore
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
    const func = (await this.hasWrappedAsset({
      ...vaa.payload.token,
    }))
      ? 'createWrapped'
      : 'updateWrapped';
    yield this.createUnsignedTx(
      await this.tokenBridge[func].populateTransaction(serialize(vaa)),
      'TokenBridge.' + func,
    );
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

  async parseTransactionDetails(
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]> {
    const receipt = await this.provider.getTransactionReceipt(txid);
    if (receipt === null)
      throw new Error(`No transaction found with txid: ${txid}`);

    const { fee: gasFee } = receipt;

    const core = this.contracts.mustGetCore(this.chain, this.provider);
    const coreAddress = await core.getAddress();

    const bridge = this.contracts.mustGetTokenBridge(this.chain, this.provider);
    const bridgeAddress = new EvmAddress(
      await bridge.getAddress(),
    ).toUniversalAddress();

    const bridgeLogs = receipt.logs.filter((l: any) => {
      return l.address === coreAddress;
    });

    const impl = this.contracts.getImplementation();
    const parsedLogs = bridgeLogs.map(async (bridgeLog) => {
      const { topics, data } = bridgeLog;
      const parsed = impl.parseLog({ topics: topics.slice(), data });

      // TODO: should we be nicer here?
      if (parsed === null) throw new Error(`Failed to parse logs: ${data}`);

      // parse token bridge message, 0x01 == transfer, attest == 0x02,  w/ payload 0x03
      let parsedTransfer:
        | BridgeStructs.TransferStructOutput
        | BridgeStructs.TransferWithPayloadStructOutput;

      if (parsed.args.payload.startsWith('0x01')) {
        // parse token bridge transfer data
        parsedTransfer = await bridge.parseTransfer(parsed.args.payload);
      } else if (parsed.args.payload.startsWith('0x03')) {
        // parse token bridge transfer with payload data
        parsedTransfer = await bridge.parseTransferWithPayload(
          parsed.args.payload,
        );
      } else {
        // git gud
        throw new Error(
          `unrecognized payload for ${txid}: ${parsed.args.payload}`,
        );
      }

      const toChain = toChainName(parsedTransfer.toChain);
      const tokenAddress = new UniversalAddress(parsedTransfer.tokenAddress);
      const tokenChain = toChainName(parsedTransfer.tokenChain);

      const ttt: TokenTransferTransaction = {
        message: {
          tx: { chain: this.chain, txid },
          msg: {
            chain: this.chain,
            emitter: bridgeAddress,
            sequence: parsed.args.sequence,
          },
          payloadId: parsedTransfer.payloadID,
        },
        details: {
          token: { chain: tokenChain, address: tokenAddress },
          amount: parsedTransfer.amount,
          from: {
            chain: this.chain,
            address: new EvmAddress(receipt.from).toUniversalAddress(),
          },
          to: {
            chain: toChain,
            address: new UniversalAddress(parsedTransfer.to),
          },
        },
        block: BigInt(receipt.blockNumber),
        gasFee,
      };
      return ttt;
    });

    return await Promise.all(parsedLogs);
  }

  async getWrappedNative(): Promise<TokenId> {
    const address = await this.tokenBridge.WETH();
    return {
      chain: this.chain,
      address: new EvmAddress(address).toUniversalAddress(),
    };
  }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    parallelizable: boolean = false,
  ): EvmUnsignedTransaction {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
