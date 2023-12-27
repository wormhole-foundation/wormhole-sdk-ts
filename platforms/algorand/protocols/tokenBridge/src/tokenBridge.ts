import {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  ErrNotWrapped,
  NativeAddress,
  Network,
  Platform,
  TokenAddress,
  TokenBridge,
  TokenId,
  UniversalAddress,
  UnsignedTransaction,
  serialize,
  toChain,
  toChainId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import {
  AlgorandAddress,
  AlgorandChains,
  AlgorandPlatform,
  AlgorandPlatformType,
  AlgorandUnsignedTransaction,
  AlgorandZeroAddress,
  AnyAlgorandAddress,
  TransactionSignerPair,
} from "@wormhole-foundation/connect-sdk-algorand";
import { Algodv2, bigIntToBytes, bytesToBigInt, getApplicationAddress } from "algosdk";
import {
  getIsWrappedAssetOnAlgorand,
  getOriginalAssetOffAlgorand,
  getWrappedAssetOnAlgorand,
} from "./assets";
import {
  attestFromAlgorand,
  getIsTransferCompletedAlgorand,
  redeemOnAlgorand,
  transferFromAlgorand,
} from "./transfers";
import { submitVAAHeader } from "./_vaa";

export class AlgorandTokenBridge<N extends Network, C extends AlgorandChains>
  implements TokenBridge<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAddress: string;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    if (!contracts.coreBridge) {
      throw new Error(`Core contract address for chain ${chain} not found`);
    }
    const core = BigInt(contracts.coreBridge);
    this.coreAppId = core;
    this.coreAppAddress = getApplicationAddress(core);

    if (!contracts.tokenBridge) {
      throw new Error(`TokenBridge contract address for chain ${chain} not found`);
    }
    const tokenBridge = BigInt(contracts.tokenBridge);
    this.tokenBridgeAppId = tokenBridge;
    this.tokenBridgeAddress = getApplicationAddress(tokenBridge);
  }

  static async fromRpc<N extends Network>(
    provider: Algodv2,
    config: ChainsConfig<N, Platform>,
  ): Promise<AlgorandTokenBridge<N, AlgorandChains>> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new AlgorandTokenBridge(network as N, chain, provider, conf.contracts);
  }

  // Checks a native address to see if it's a wrapped version
  async isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    const assetId = bytesToBigInt(new AlgorandAddress(token.toString()).toUint8Array());

    const isWrapped = await getIsWrappedAssetOnAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      assetId,
    );
    return isWrapped;
  }

  // Returns the original asset with its foreign chain
  async getOriginalAsset(token: TokenAddress<C>): Promise<TokenId> {
    if (!(await this.isWrappedAsset(token))) throw ErrNotWrapped(token.toString());

    const assetId = bytesToBigInt(new AlgorandAddress(token.toString()).toUint8Array());

    const whWrappedInfo = await getOriginalAssetOffAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      assetId,
    );
    const tokenId = {
      chain: toChain(whWrappedInfo.chainId),
      address: new UniversalAddress(whWrappedInfo.assetAddress),
    };
    return tokenId;
  }

  // Returns the address of the native version of this asset
  async getWrappedAsset(token: TokenId<Chain>): Promise<NativeAddress<C>> {
    const assetId = await getWrappedAssetOnAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      token.chain,
      token.address.toString(),
    );

    if (assetId === null) {
      throw new Error(`Algorand asset ${token.address} not found`);
    }

    const nativeAddress = toNative(this.chain, bigIntToBytes(assetId, 8));
    return nativeAddress;
  }

  // Checks if a wrapped version exists
  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (e) {}
    return false;
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    return toNative(this.chain, new AlgorandAddress(AlgorandZeroAddress).toString());
  }

  async isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
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
    token_to_attest: AnyAlgorandAddress,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    if (!payer) throw new Error("Payer required to create attestation");

    const senderAddr = payer.toString();
    const assetId = bytesToBigInt(new AlgorandAddress(token_to_attest.toString()).toUint8Array());
    const utxns = await attestFromAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      senderAddr.toString(),
      assetId,
    );

    for (const utxn of utxns) {
      yield this.createUnsignedTx(utxn, "Algorand.TokenBridge.createAttestation", true);
    }
  }

  // Submits the Token Attestation VAA to the Token Bridge
  // to create the wrapped token represented by the data in the VAA
  async *submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
    payer?: AnyAlgorandAddress,
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    if (!payer) throw new Error("Payer required to create attestation");

    const senderAddr = payer.toString();
    const { txs } = await submitVAAHeader(
      this.connection,
      this.tokenBridgeAppId,
      serialize(vaa),
      senderAddr,
      this.coreAppId,
    );

    for (const utxn of txs) {
      yield this.createUnsignedTx(utxn, "Algorand.TokenBridge.submitAttestation", true);
    }
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress<C>,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    const senderAddr = sender.toString();
    const assetId =
      token === "native" ? BigInt(0) : bytesToBigInt(new AlgorandAddress(token).toUint8Array());
    const qty = amount;
    const chain = recipient.chain;

    const receiver = recipient.address.toUniversalAddress();

    const fee = BigInt(0);
    console.log(
      "About to transferFromAlgorand: ",
      senderAddr,
      assetId,
      qty,
      receiver.toString(),
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
      yield this.createUnsignedTx(utxn, "Algorand.TokenBridge.transfer", true);
    }
  }

  // Redeems a transfer VAA to receive the tokens on this chain
  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative: boolean = true,
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    const senderAddr = new AlgorandAddress(sender.toString()).toString();

    const utxns = await redeemOnAlgorand(
      this.connection,
      this.tokenBridgeAppId,
      this.coreAppId,
      serialize(vaa),
      senderAddr,
    );

    for (const utxn of utxns) {
      yield this.createUnsignedTx(utxn, "Algorand.TokenBridge.redeem", true);
    }
  }

  private createUnsignedTx(
    txReq: TransactionSignerPair,
    description: string,
    parallelizable: boolean = true, // Default true for Algorand atomic transaction grouping
  ): AlgorandUnsignedTransaction<N, C> {
    return new AlgorandUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
