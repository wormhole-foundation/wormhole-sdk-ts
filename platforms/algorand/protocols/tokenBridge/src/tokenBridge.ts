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
import { Algodv2 } from "algosdk";

import {
  AlgorandChains,
  AlgorandPlatform,
  AlgorandPlatformType,
} from "@wormhole-foundation/connect-sdk-algorand";

export class AlgorandTokenBridge<N extends Network, C extends AlgorandChains>
  implements TokenBridge<N, AlgorandPlatformType, C>
{
  readonly tokenBridgeAddress: string;
  readonly chainId: bigint;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(network, chain) as bigint;

    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(`Wormhole Token Bridge contract for domain ${chain} not found`);

    this.tokenBridgeAddress = tokenBridgeAddress;
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

  async *createAttestation(token: TokenAddress<C>) {
    throw new Error("Not implemented");
  }

  async *submitAttestation(vaa: TokenBridge.VAA<"AttestMeta">) {
    throw new Error("Not implemented");
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ) {
    throw new Error("Not implemented");
  }

  async *redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative: boolean = true,
  ) {
    throw new Error("Not implemented");
  }

  async getWrappedNative(): Promise<NativeAddress<C>> {
    throw new Error("Not implemented");
  }

  // TODO: uncomment and use
  // private createUnsignedTx(
  //   txReq: Transaction,
  //   description: string,
  //   parallelizable: boolean = false,
  // ): AlgorandUnsignedTransaction<N, C> {
  //   throw new Error("Not implemented");
  // }
}
