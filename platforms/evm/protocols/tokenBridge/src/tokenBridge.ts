import {
  toChainId,
  chainIdToChain,
  Network,
  toChainName,
  serialize,
  UniversalAddress,
  ChainAddress,
  TokenBridge,
  TxHash,
  keccak256,
  TokenId,
  NativeAddress,
  toNative,
  ErrNotWrapped,
  TokenTransferTransaction,
  Contracts,
  ChainsConfig,
} from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';

import {
  TokenBridgeContract,
  TokenImplementation__factory as TokenContractFactory,
} from './ethers-contracts';
import { BridgeStructs } from './ethers-contracts/Bridge';
import { ethers_contracts } from '.';

import {
  evmNetworkChainToEvmChainId,
  EvmUnsignedTransaction,
  EvmChainName,
  addFrom,
  addChainId,
  unusedArbiterFee,
  unusedNonce,
  AnyEvmAddress,
  EvmAddress,
  EvmZeroAddress,
  EvmPlatform,
} from '@wormhole-foundation/connect-sdk-evm';

//Currently the code does not consider Wormhole msg fee (because it is and always has been 0).

//TODO more checks to determine that all necessary preconditions are met (e.g. that balances are
//  sufficient) for a given transaction to succeed
// Action items: add a validate method and a simulate transfer method

export class EvmTokenBridge implements TokenBridge<'Evm'> {
  readonly tokenBridge: TokenBridgeContract;
  readonly tokenBridgeAddress: string;
  readonly chainId: bigint;

  private constructor(
    readonly network: Network,
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    this.chainId = evmNetworkChainToEvmChainId.get(network, chain)!;

    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(
        `Wormhole Token Bridge contract for domain ${chain} not found`,
      );

    this.tokenBridgeAddress = tokenBridgeAddress
    this.tokenBridge = ethers_contracts.Bridge__factory.connect(
      this.tokenBridgeAddress,
      provider
    )
  }

  static async fromProvider(
    provider: Provider,
    config: ChainsConfig,
  ): Promise<EvmTokenBridge> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    return new EvmTokenBridge(network, chain, provider, config[chain]!.contracts!);
  }

  async isWrappedAsset(token: AnyEvmAddress): Promise<boolean> {
    return await this.tokenBridge.isWrappedAsset(
      new EvmAddress(token).toString(),
    );
  }

  async getOriginalAsset(token: AnyEvmAddress): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token)))
      throw ErrNotWrapped(token.toString());

    const tokenContract = TokenContractFactory.connect(
      new EvmAddress(token).toString(),
      this.provider,
    );
    const [chain, address] = await Promise.all([
      tokenContract.chainId().then(Number).then(toChainId).then(chainIdToChain),
      tokenContract.nativeContract().then((addr) => new UniversalAddress(addr)),
    ]);
    return { chain, address };
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      //TODO it's unclear to me why this would throw for a non-existent token but that's how the
      //  old sdk checked for existence
      await this.getWrappedAsset(token);
      return true;
    } catch (e) { }
    return false;
  }

  async getWrappedAsset(token: TokenId): Promise<NativeAddress<'Evm'>> {
    const wrappedAddress = await this.tokenBridge.wrappedAsset(
      toChainId(token.chain),
      token.address.toUniversalAddress().toString(),
    );

    if (wrappedAddress === EvmZeroAddress)
      throw ErrNotWrapped(token.address.toUniversalAddress().toString());

    return toNative('Evm', wrappedAddress);
  }

  async isTransferCompleted(
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
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

  async *createAttestation(
    token: AnyEvmAddress,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const ignoredNonce = 0;
    yield this.createUnsignedTx(
      await this.tokenBridge.attestToken.populateTransaction(
        new EvmAddress(token).toString(),
        ignoredNonce,
      ),
      'TokenBridge.createAttestation',
    );
  }

  async *submitAttestation(
    vaa: TokenBridge.VAA<'AttestMeta'>,
  ): AsyncGenerator<EvmUnsignedTransaction> {
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
    sender: AnyEvmAddress,
    recipient: ChainAddress,
    token: AnyEvmAddress | 'native',
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = new EvmAddress(sender).toString();
    const recipientChainId = toChainId(recipient.chain);
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
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
      const tokenAddr = new EvmAddress(token).toString();
      const tokenContract = EvmPlatform.getTokenImplementation(this.provider, tokenAddr);

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

  async *redeem(
    sender: AnyEvmAddress,
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
    unwrapNative: boolean = true,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = new EvmAddress(sender).toString();
    if (
      vaa.payloadName === 'TransferWithPayload' &&
      vaa.payload.token.chain !== this.chain
    ) {
      const fromAddr = toNative(this.chain, vaa.payload.from).unwrap();
      if (fromAddr !== senderAddr)
        throw new Error(
          `VAA.from (${fromAddr}) does not match sender (${senderAddr})`,
        );
    }

    const wrappedNativeAddr = await this.tokenBridge.WETH();
    const tokenAddr = toNative(this.chain, vaa.payload.token.address).unwrap();
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

    const bridgeAddress = toNative(
      this.chain,
      this.tokenBridgeAddress,
    ).toUniversalAddress();

    const bridgeLogs = receipt.logs.filter((l: any) => {
      return l.address === this.contracts.coreBridge;
    });

    const impl = ethers_contracts.Implementation__factory.createInterface();

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
        parsedTransfer = await this.tokenBridge.parseTransfer(parsed.args.payload);
      } else if (parsed.args.payload.startsWith('0x03')) {
        // parse token bridge transfer with payload data
        parsedTransfer = await this.tokenBridge.parseTransferWithPayload(
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
            address: toNative(this.chain, receipt.from),
          },
          to: {
            chain: toChain,
            address: toNative(toChain, parsedTransfer.to),
          },
        },
        block: BigInt(receipt.blockNumber),
        gasFee,
      };
      return ttt;
    });

    return await Promise.all(parsedLogs);
  }

  async getWrappedNative(): Promise<NativeAddress<'Evm'>> {
    const address = await this.tokenBridge.WETH();
    return toNative(this.chain, address);
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
