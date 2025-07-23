import { ChainContext, ChainsConfig, chainToPlatform, ChainToPlatform, Network, networkPlatformConfigs, PlatformContext, RpcConnection, StaticPlatformMethods, TokenId, TxHash, SignedTx, isNative, decimals, TokenAddress, Wormhole } from "@wormhole-foundation/sdk-connect";
import { _platform, StacksChains, StacksPlatformType } from "./types.js";
import { Chain } from "@wormhole-foundation/sdk-connect";
import { StacksChain } from "./chain.js";

export class StacksPlatform<N extends Network> extends PlatformContext<N, StacksPlatformType> 
  implements StaticPlatformMethods<StacksPlatformType, typeof StacksPlatform> {

  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, StacksPlatformType>) {
    super(
      network,
      config ?? networkPlatformConfigs(network, StacksPlatform._platform),
    );
  }

  override getRpc<C extends "Stacks">(chain: C) {
    throw new Error("Method not implemented.");
  }

  override getChain<C extends "Stacks">(chain: C, rpc?: RpcConnection<"Stacks">): ChainContext<N, C, ChainToPlatform<C>> {
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
    // Replace with the appropriate zero address for Stacks
    // This is a placeholder - you need to define the actual native token address for Stacks
    return Wormhole.tokenId(chain, "0x00");
  }

  static isNativeTokenId<N extends Network, C extends StacksChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!StacksPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    // Replace with the appropriate check for native token in Stacks
    return tokenId.address.toString() === "0x00";
  }

  static async getDecimals<C extends StacksChains>(
    _network: Network,
    _chain: C,
    rpc: RpcConnection<"Stacks">,
    token: TokenAddress<C>,
  ): Promise<number> {
    if (isNative(token)) return decimals.nativeDecimals(StacksPlatform._platform);
    
    // Implement token decimals lookup for Stacks
    throw new Error("Method not implemented.");
  }

  static async getBalance<C extends StacksChains>(
    _network: Network,
    _chain: C,
    rpc: RpcConnection<"Stacks">,
    walletAddr: string,
    token: TokenAddress<C>,
  ): Promise<bigint | null> {
    // Implement balance lookup for Stacks
    throw new Error("Method not implemented.");
  }

  static async getLatestBlock(rpc: RpcConnection<"Stacks">): Promise<number> {
    // Implement getting latest block for Stacks
    throw new Error("Method not implemented.");
  }

  static async getLatestFinalizedBlock(rpc: RpcConnection<"Stacks">): Promise<number> {
    // Implement getting latest finalized block for Stacks
    throw new Error("Method not implemented.");
  }

  static async sendWait<C extends StacksChains>(
    chain: C,
    rpc: RpcConnection<"Stacks">,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    // Implement sending transactions and waiting for confirmation
    throw new Error("Method not implemented.");
  }

  static chainFromChainId(chainId: string): [Network, StacksChains] {
    // TODO FG TODO
    throw new Error("Method not implemented.");
  }

  static async chainFromRpc(rpc: RpcConnection<"Stacks">): Promise<[Network, StacksChains]> {
    // TODO FG TODO
    return ["Testnet", "Stacks"];
  }
}
