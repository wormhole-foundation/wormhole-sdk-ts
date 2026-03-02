import type {
  Chain,
  ChainsConfig,
  Network, 
  RpcConnection,
  StaticPlatformMethods,
  TokenId,
  TxHash,
  SignedTx,
  TokenAddress} from "@wormhole-foundation/sdk-connect";
import {
  chainToPlatform,
  networkPlatformConfigs,
  PlatformContext,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";
import type { BtcChains, BtcPlatformType } from "./types.js";
import { _platform } from "./types.js";
import { BtcChain } from "./chain.js";

export class BtcPlatform<N extends Network>
  extends PlatformContext<N, BtcPlatformType>
  implements StaticPlatformMethods<BtcPlatformType, typeof BtcPlatform>
{
  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, BtcPlatformType>) {
    super(network, config ?? networkPlatformConfigs(network, BtcPlatform._platform));
  }

  override getRpc<C extends BtcChains>(_chain: C): never {
    throw new Error(
      "BtcPlatform does not provide an RPC connection — Bitcoin interactions are handled externally",
    );
  }

  override getChain<C extends BtcChains>(chain: C): BtcChain<N, C> {
    if (chain in this.config) {
      return new BtcChain<N, C>(chain, this);
    }
    throw new Error("No configuration available for chain: " + chain);
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === BtcPlatform._platform;
  }

  static nativeTokenId<N extends Network, C extends BtcChains>(_network: N, chain: C): TokenId<C> {
    if (!BtcPlatform.isSupportedChain(chain)) {
      throw new Error(`invalid chain for Btc: ${chain}`);
    }
    return Wormhole.tokenId(chain, "native");
  }

  static isNativeTokenId<N extends Network, C extends BtcChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!BtcPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = BtcPlatform.nativeTokenId(network, chain);
    return native.address === tokenId.address;
  }

  static async getDecimals<C extends BtcChains>(
    _network: Network,
    _chain: C,
    _rpc: RpcConnection<C>,
    _token: TokenAddress<C>,
  ): Promise<number> {
    return 8;
  }

  static async getBalance<C extends BtcChains>(
    _network: Network,
    _chain: C,
    _rpc: RpcConnection<C>,
    _walletAddr: string,
    _token: TokenAddress<C>,
  ): Promise<bigint | null> {
    return null;
  }

  static async getLatestBlock<C extends BtcChains>(_rpc: RpcConnection<C>): Promise<number> {
    return 0;
  }

  static async getLatestFinalizedBlock<C extends BtcChains>(
    _rpc: RpcConnection<C>,
  ): Promise<number> {
    return 0;
  }

  static async sendWait<C extends BtcChains>(
    _chain: C,
    _rpc: RpcConnection<C>,
    _stxns: SignedTx[],
  ): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  static chainFromChainId(_chainId: string): [Network, BtcChains] {
    throw new Error("Method not implemented.");
  }

  static async chainFromRpc(_rpc: RpcConnection<BtcPlatformType>): Promise<[Network, BtcChains]> {
    throw new Error("Method not implemented.");
  }
}
