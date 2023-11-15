import { JsonRpcProvider, SUI_CLOCK_OBJECT_ID, TransactionBlock } from "@mysten/sui.js";
import {
  AccountAddress,
  Chain,
  ChainAddress,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  Platform,
  TokenAddress,
  TokenBridge,
  TokenId,
  nativeChainIds,
} from "@wormhole-foundation/connect-sdk";

import {
  SuiChains,
  SuiPlatform,
  SuiPlatformType,
  SuiUnsignedTransaction,
} from "@wormhole-foundation/connect-sdk-sui";

export class SuiTokenBridge<N extends Network, C extends SuiChains>
  implements TokenBridge<N, SuiPlatformType, C>
{
  readonly coreBridgePackageId: string;
  readonly tokenBridgePackageId: string;
  readonly chainId: bigint;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: JsonRpcProvider,
    readonly contracts: Contracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(network, chain) as bigint;

    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    const coreBridgeAddress = this.contracts.coreBridge!;
    if (!coreBridgeAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    this.tokenBridgePackageId = tokenBridgeAddress;
    this.coreBridgePackageId = coreBridgeAddress;
  }

  static async fromRpc<N extends Network>(
    provider: JsonRpcProvider,
    config: ChainsConfig<N, Platform>,
  ): Promise<SuiTokenBridge<N, SuiChains>> {
    const [network, chain] = await SuiPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new SuiTokenBridge(network as N, chain, provider, conf.contracts);
  }

  async isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    throw new Error("Not implemented");
  }

  async getOriginalAsset(token: TokenAddress<C>): Promise<TokenId> {
    throw new Error("Not implemented");
  }

  async hasWrappedAsset(token: TokenId): Promise<boolean> {
    try {
      await this.getWrappedAsset(token);
      return true;
    } catch (e) {}
    return false;
  }

  async getWrappedAsset(token: TokenId<Chain>): Promise<NativeAddress<C>> {
    throw new Error("Not implemented");
  }

  async isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
  ): Promise<boolean> {
    throw new Error("Not implemented");
  }

  async *createAttestation(token: TokenAddress<C>): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    const feeAmount = 0n;
    const nonce = 0n;
    const coinType = token.toString();

    const tokenBridgeStateObjectId = "todo";
    const coreBridgeStateObjectId = "todo";

    const metadata = await this.provider.getCoinMetadata({ coinType });

    if (metadata === null || metadata.id === null)
      throw new Error(`Coin metadata ID for type ${coinType} not found`);

    const tx = new TransactionBlock();
    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure(feeAmount)]);
    const [messageTicket] = tx.moveCall({
      target: `${this.tokenBridgePackageId}::attest_token::attest_token`,
      arguments: [tx.object(tokenBridgeStateObjectId), tx.object(metadata.id), tx.pure(nonce)],
      typeArguments: [coinType],
    });
    tx.moveCall({
      target: `${this.coreBridgePackageId}::publish_message::publish_message`,
      arguments: [
        tx.object(coreBridgeStateObjectId),
        feeCoin!,
        messageTicket!,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    yield this.createUnsignedTx(tx, "Sui.CreateAttestation");
  }

  async *submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    throw new Error("Not implemented");
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    throw new Error("Not implemented");
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative: boolean = true,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    throw new Error("Not implemented");
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    throw new Error("Not implemented");
  }

  // @ts-ignore
  private createUnsignedTx(
    txReq: TransactionBlock,
    description: string,
    parallelizable: boolean = false,
  ): SuiUnsignedTransaction<N, C> {
    throw new Error("Not implemented");
  }
}
