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
  ChainName,
} from '@wormhole-foundation/connect-sdk';
import {
  AlgorandAddress,
  AlgorandChainName,
  AlgorandUnsignedTransaction,
  AlgorandZeroAddress,
} from '../../../src';
import { Algodv2, getApplicationAddress } from 'algosdk';
import {
  attestFromAlgorand,
  getForeignAssetAlgorand,
  getIsTransferCompletedAlgorand,
  getIsWrappedAssetAlgorand,
  getOriginalAssetAlgorand,
  redeemOnAlgorand,
  transferFromAlgorand,
} from './utils';
import { toChainName } from '@wormhole-foundation/connect-sdk';
import { UniversalAddress } from '@wormhole-foundation/connect-sdk';

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

    const tokenBridge = BigInt(contracts.tokenBridge);
    if (!tokenBridge) {
      throw new Error(
        `TokenBridge contract address for chain ${chain} not found`,
      );
    }
    this.tokenBridgeAppId = tokenBridge;
    this.tokenBridgeAddress = getApplicationAddress(tokenBridge);

    const core = BigInt(contracts.coreBridge);
    if (!core) {
      throw new Error(`Core contract address for chain ${chain} not found`);
    }
    this.coreAppId = core;
    this.coreAppAddress = getApplicationAddress(core);
  }

  // Checks a native address to see if its a wrapped version
  async isWrappedAsset(nativeAddress: AnyAddress): Promise<boolean> {
    // QUESTION: This has been forced by coercing nativeAddress toString() - better way?
    const token = new AlgorandAddress(nativeAddress.toString()).toBigInt();

    const isWrapped = await getIsWrappedAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      // QUESTION: This has been forced by coercing nativeAddress toString() - better way?
      token,
    );
    return isWrapped;
  }

  // Returns the original asset with its foreign chain
  async getOriginalAsset(nativeAddress: AnyAddress): Promise<TokenId> {
    if (!(await this.isWrappedAsset(nativeAddress)))
      throw ErrNotWrapped(nativeAddress.toString());

    // QUESTION: This has been forced (in multiple places) by coercing nativeAddress toString() - better way?
    const token = new AlgorandAddress(nativeAddress.toString()).toBigInt();

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
    // QUESTION: Is this right?  What represented the Algorand native asset?
    return toNative(
      this.chain,
      new AlgorandAddress(AlgorandZeroAddress).toString(),
    );
  }

  // Checks to see if a foreign token has a wrapped version
  async hasWrappedAsset(foreignToken: TokenId): Promise<boolean> {
    // QUESTION: Why does TS think that mirror will only be bigint?
    const mirror = await getForeignAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      // QUESTION: This doesn't work because the wormhole-sdk has a type with lowercase names of chains
      foreignToken.chain,
      // Just added .toString() here
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
  ): Promise<NativeAddress<'Algorand'>> {
    const assetId = await getForeignAssetAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      foreignToken.chain,
      foreignToken.address.toString(),
    );

    const nativeAddress = new AlgorandAddress(assetId);
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
    payer?: AnyAddress,
  ): AsyncGenerator<UnsignedTransaction> {
    if (!payer) throw new Error('Payer required to create attestation');

    const senderAddr = new AlgorandAddress(payer.toString());
    const assetId = new AlgorandAddress(token_to_attest.toString()).toBigInt();
    const utxn = await attestFromAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      senderAddr.toString(),
      assetId,
    );

    yield this.createUnsignedTransaction(
      utxn,
      this.network,
      this.chain,
      'Algorand.TokenBridge.createAttestation',
    );
  }

  // Submits the Token Attestation VAA to the Token bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.VAA<'AttestMeta'>,
    payer?: AnyAddress,
  ): AsyncGenerator<UnsignedTransaction> {
    if (!payer) throw new Error('Payer required to create attestation');
  }

  // Initiates a transfer of some token to another chain
  async *transfer(
    sender: AnyAddress,
    recipient: ChainAddress,
    token: AnyAddress,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = new AlgorandAddress(sender.toString()).toString();
    const assetId = new AlgorandAddress(token.toString()).toBigInt();
    const qty = amount;
    const receiver = recipient.address;
    const chain = recipient.chain;
    const fee = BigInt(0);
    const utxn = await transferFromAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      senderAddr,
      assetId,
      qty,
      receiver.toString(),
      chain,
      fee,
      payload,
    );

    yield this.createUnsignedTransaction(
      utxn,
      this.network,
      this.chain,
      'Algorand.TokenBridge.transfer',
    );
  }

  // Redeems a transfer VAA to receive the tokens on this chain
  async *redeem(
    sender: AnyAddress,
    vaa: TokenBridge.VAA<'Transfer' | 'TransferWithPayload'>,
    unwrapNative?: boolean, //default: true
  ): AsyncGenerator<UnsignedTransaction> {
    const senderAddr = new AlgorandAddress(sender.toString()).toString();

    const utxn = redeemOnAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      serialize(vaa),
      senderAddr,
    );

    yield this.createUnsignedTransaction(
      utxn,
      this.network,
      this.chain,
      'Algorand.TokenBridge.redeem',
    );
  }

  private createUnsignedTransaction(
    transaction: any,
    network: Network,
    chain: ChainName,
    description: string,
    parallelizable: boolean = false,
  ): AlgorandUnsignedTransaction {
    return new AlgorandUnsignedTransaction(
      // TODO: On Algorand, "transaction" is going to need to be a group
      transaction,
      network,
      chain,
      description,
      parallelizable,
    );
  }
}
