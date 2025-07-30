import { ChainContext, ChainsConfig, chainToPlatform, ChainToPlatform, Network, networkPlatformConfigs, PlatformContext, RpcConnection, StaticPlatformMethods, TokenId, TxHash, SignedTx, isNative, decimals, TokenAddress, Wormhole } from "@wormhole-foundation/sdk-connect";
import { _platform, StacksChains, StacksPlatformType } from "./types.js";
import { Chain } from "@wormhole-foundation/sdk-connect";
import { StacksChain } from "./chain.js";
import { networkFromName, STACKS_MAINNET, STACKS_TESTNET, StacksNetwork, StacksNetworkName } from "@stacks/network";

export class StacksPlatform<N extends Network> extends PlatformContext<N, StacksPlatformType> 
  implements StaticPlatformMethods<StacksPlatformType, typeof StacksPlatform> {

  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, StacksPlatformType>) {
    super(
      network,
      config ?? networkPlatformConfigs(network, StacksPlatform._platform),
    );
  }

  override getRpc(): StacksNetwork {
    return networkFromName(this.network.toLowerCase() as StacksNetworkName)
  }

  override getChain<C extends StacksChains>(chain: C, rpc?: RpcConnection<C>): ChainContext<N, C, ChainToPlatform<C>> {
    if(chain in this.config) {
      return new StacksChain<N, C>(chain, this, rpc);
    }
    throw new Error("No configuration available for chain: " + chain);
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === StacksPlatform._platform;
  }

  static nativeTokenId<N extends Network, C extends StacksChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    if (!StacksPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for Stacks: ${chain}`);
    // TODO FG TODO
    return Wormhole.tokenId(chain, "0x00");
  }

  static isNativeTokenId<N extends Network, C extends StacksChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!StacksPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    // TODO FG TODO
    return tokenId.address.toString() === "0x00";
  }

  static async getDecimals<C extends StacksChains>(
    _network: Network,
    _chain: C,
    rpc: RpcConnection<C>,
    token: TokenAddress<C>,
  ): Promise<number> {
    if (isNative(token)) return decimals.nativeDecimals(StacksPlatform._platform);
    
    // Implement token decimals lookup for Stacks
    throw new Error("Method not implemented.");
  }

  static async getBalance<C extends StacksChains>(
    _network: Network,
    _chain: C,
    rpc: RpcConnection<C>,
    walletAddr: string,
    token: TokenAddress<C>,
  ): Promise<bigint | null> {
    throw new Error("Method not implemented.");
  }

  static async getLatestBlock<C extends StacksChains>(rpc: RpcConnection<C>): Promise<number> {
    throw new Error("Method not implemented.");
  }

  static async getLatestFinalizedBlock<C extends StacksChains>(rpc: RpcConnection<C>): Promise<number> {
    throw new Error("Method not implemented.");
  }

  static async sendWait<C extends StacksChains>(
    chain: C,
    rpc: RpcConnection<C>,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  static chainFromChainId(chainId: string): [Network, StacksChains] {
    throw new Error("Method not implemented.");
  }

  static async chainFromRpc(rpc: StacksNetwork): Promise<[Network, StacksChains]> {
    const rpcUrl = rpc.client.baseUrl
    switch (rpcUrl) {
      case STACKS_MAINNET.client.baseUrl:
        return ['Mainnet', 'Stacks'];
      case STACKS_TESTNET.client.baseUrl:
        return ['Testnet', 'Stacks'];
      default:
        return ['Devnet', 'Stacks'];
    }
  }
}
