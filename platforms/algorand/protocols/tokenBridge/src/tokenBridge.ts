import {
  Network,
  ChainId,
  TokenBridge,
  Contracts,
  toChainId,
  TokenId,
  NativeAddress,
  AnyAddress,
  ChainAddress,
  toNative,
  ErrNotWrapped,
  serialize,
  UnsignedTransaction,
  toChainName,
  UniversalAddress,
  ChainsConfig,
} from '@wormhole-foundation/connect-sdk';
import {
  AlgorandAddress,
  AlgorandChainName,
  AlgorandPlatform,
  AlgorandUnsignedTransaction,
  AlgorandZeroAddress,
  AnyAlgorandAddress,
  TransactionSignerPair,
} from '@wormhole-foundation/connect-sdk-algorand';
import {
  Algodv2,
  bigIntToBytes,
  bytesToBigInt,
  getApplicationAddress,
} from 'algosdk';
import {
  attestFromAlgorand,
  getForeignAssetAlgorand,
  getIsTransferCompletedAlgorand,
  getIsWrappedAssetAlgorand,
  getOriginalAssetAlgorand,
  redeemOnAlgorand,
  submitVAAHeader,
  transferFromAlgorand,
} from './utils';

export class AlgorandTokenBridge implements TokenBridge<'Algorand'> {
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAddress: string;

  private constructor(
    readonly network: Network,
    readonly chain: AlgorandChainName,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    if (!contracts.tokenBridge) {
      throw new Error(
        `TokenBridge contract address for chain ${chain} not found`,
      );
    }
    const tokenBridge = BigInt(contracts.tokenBridge);
    this.tokenBridgeAppId = tokenBridge;
    this.tokenBridgeAddress = getApplicationAddress(tokenBridge);

    if (!contracts.coreBridge) {
      throw new Error(`Core contract address for chain ${chain} not found`);
    }
    const core = BigInt(contracts.coreBridge);
    this.coreAppId = core;
    this.coreAppAddress = getApplicationAddress(core);
  }

  static async fromRpc(
    rpc: Algodv2,
    config: ChainsConfig,
  ): Promise<AlgorandTokenBridge> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(rpc);
    return new AlgorandTokenBridge(
      network,
      chain,
      rpc,
      config[chain]!.contracts,
    );
  }

  // Checks a native address to see if its a wrapped version
  async isWrappedAsset(nativeAddress: AnyAddress): Promise<boolean> {
    // QUESTIONBW: This has been forced by coercing nativeAddress toString() - better way?
    const token = bytesToBigInt(
      new AlgorandAddress(nativeAddress.toString()).toUint8Array(),
    );

    const isWrapped = await getIsWrappedAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      // QUESTIONBW: This has been forced by coercing nativeAddress toString() - better way?
      token,
    );
    return isWrapped;
  }

  // Returns the original asset with its foreign chain
  async getOriginalAsset(nativeAddress: AnyAddress): Promise<TokenId> {
    if (!(await this.isWrappedAsset(nativeAddress)))
      throw ErrNotWrapped(nativeAddress.toString());

    // QUESTIONBW: This has been forced (in multiple places) by coercing nativeAddress toString() - better way?
    const token = bytesToBigInt(
      new AlgorandAddress(nativeAddress.toString()).toUint8Array(),
    );

    const whWrappedInfo = await getOriginalAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      token,
    );
    const tokenId = {
      chain: toChainName(whWrappedInfo.chainId),
      address: new UniversalAddress(whWrappedInfo.assetAddress),
    };
    return tokenId;
  }

  // Returns the wrapped version of the native asset
  async getWrappedNative(): Promise<NativeAddress<'Algorand'>> {
    // QUESTIONBW: Is this right?  What represented the Algorand native asset?
    return toNative(
      this.chain,
      new AlgorandAddress(AlgorandZeroAddress).toString(),
    );
  }

  // Checks to see if a foreign token has a wrapped version
  async hasWrappedAsset(foreignToken: TokenId): Promise<boolean> {
    // QUESTIONBW: Why does TS think that mirror will only be bigint?
    const mirror = await getForeignAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      foreignToken.chain,
      // QUESTIONBW: Just added .toString() here.  Does this work?
      foreignToken.address.toString(),
    );
    // Even a bigint of 0 would be valid?  So have to avoid the falsiness of BigInt(0)
    if (typeof mirror === 'bigint') {
      return true;
    } else return false;
  }

  // Returns the address of the native version of this asset
  async getWrappedAsset(
    foreignToken: TokenId,
  ): Promise<NativeAddress<AlgorandPlatform.Type>> {
    const assetId = await getForeignAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      foreignToken.chain,
      foreignToken.address.toString(),
    );

    if (assetId === null) {
      throw new Error(`Algorand asset ${foreignToken.address} not found`);
    }

    const nativeAddress = toNative('Algorand', bigIntToBytes(assetId, 8));
    return nativeAddress;
  }

  // Checks if a transfer VAA has been redeemed
  async isTransferCompleted(
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
  ): Promise<boolean> {
    const completed = getIsTransferCompletedAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      serialize(vaa),
    );
    return completed;
  }

  // Creates a Token Attestation VAA containing metadata about
  // the token that may be submitted to a Token Bridge on another chain
  // to allow it to create a wrapped version of the token
  async *createAttestation(
    token_to_attest: AnyAddress,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<UnsignedTransaction> {
    if (!payer) throw new Error('Payer required to create attestation');

    const senderAddr = payer.toString();
    const assetId = bytesToBigInt(
      new AlgorandAddress(token_to_attest.toString()).toUint8Array(),
    );
    const utxns = await attestFromAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      senderAddr.toString(),
      assetId,
    );

    for (const utxn of utxns) {
      yield this.createUnsignedTransaction(
        utxn,
        'Algorand.TokenBridge.createAttestation',
        true,
      );
    }
  }

  // Submits the Token Attestation VAA to the Token bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.VAA<'AttestMeta'>,
    payer?: AnyAddress,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    if (!payer) throw new Error('Payer required to create attestation');

    const senderAddr = payer.toString();
    const { txs } = await submitVAAHeader(
      this.connection,
      this.tokenBridgeAppId,
      vaa.hash,
      senderAddr,
      this.coreAppId,
    );

    for (const utxn of txs) {
      yield this.createUnsignedTransaction(
        utxn,
        'Algorand.TokenBridge.submitAttestation',
        true,
      );
    }
  }

  // Initiates a transfer of some token from Algorand to another chain
  async *transfer(
    sender: AnyAlgorandAddress,
    recipient: ChainAddress,
    token: AnyAlgorandAddress | 'native',
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = sender.toString();
    const assetId =
      token === 'native'
        ? BigInt(0)
        : bytesToBigInt(new AlgorandAddress(token).toUint8Array());
    const qty = amount;
    const chain = recipient.chain;
    const receiver = recipient.address.toUniversalAddress().toString();
    const fee = BigInt(0);
    console.log(
      'About to transferFromAlgorand: ',
      senderAddr,
      assetId,
      qty,
      receiver,
      chain,
      fee,
    );
    const utxns = await transferFromAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      senderAddr,
      assetId,
      qty,
      receiver,
      chain,
      fee,
      payload,
    );

    for (const utxn of utxns) {
      yield this.createUnsignedTransaction(
        utxn,
        'Algorand.TokenBridge.transfer',
        true,
      );
    }
  }

  // Redeems a transfer VAA to receive the tokens on this chain
  async *redeem(
    sender: AnyAddress,
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
    unwrapNative?: boolean, //default: true
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = new AlgorandAddress(sender.toString()).toString();

    const utxns = await redeemOnAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      serialize(vaa),
      senderAddr,
    );

    for (const utxn of utxns) {
      yield this.createUnsignedTransaction(
        utxn,
        'Algorand.TokenBridge.redeem',
        true,
      );
    }
  }

  private createUnsignedTransaction(
    transaction: TransactionSignerPair,
    description: string,
    parallelizable: boolean = true, // Default true for Algorand atomic transaction grouping
  ): AlgorandUnsignedTransaction {
    return new AlgorandUnsignedTransaction(
      transaction,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
