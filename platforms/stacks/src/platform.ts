import { ChainContext, ChainsConfig, chainToPlatform, ChainToPlatform, Network, networkPlatformConfigs, PlatformContext, RpcConnection, StaticPlatformMethods, TokenId, TxHash, SignedTx, isNative, decimals, TokenAddress, Wormhole } from "@wormhole-foundation/sdk-connect";
import { _platform, StacksChains, StacksPlatformType } from "./types.js";
import { Chain } from "@wormhole-foundation/sdk-connect";
import { StacksChain } from "./chain.js";
import { ChainId, networkFromName, StacksNetwork, StacksNetworkName } from "@stacks/network";
import { StacksZeroAddress } from "./address.js";
import { Cl, cvToValue, fetchCallReadOnlyFunction } from "@stacks/transactions";

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
    let rpc = networkFromName(this.network.toLowerCase() as StacksNetworkName);
    (rpc as any).getNetwork = () => ({chainId: rpc.chainId})
    return rpc
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
    if (!StacksPlatform.isSupportedChain(chain)) {
      throw new Error(`invalid chain for Stacks: ${chain}`);
    }
    return Wormhole.tokenId(chain, StacksZeroAddress);
  }

  static isNativeTokenId<N extends Network, C extends StacksChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!StacksPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === StacksZeroAddress;
  }

  static async getDecimals<C extends StacksChains>(
    _network: Network,
    _chain: C,
    rpc: RpcConnection<C>,
    token: TokenAddress<C>,
  ): Promise<number> {
    if (isNative(token)) return decimals.nativeDecimals(StacksPlatform._platform);
    const [contractAddress, contractName] = token.toString().split(".")
    if(!contractAddress || !contractName) {
      throw new Error("Invalid token address");
    }
    const res = await fetchCallReadOnlyFunction({
      contractName,
      contractAddress,
      functionName: "get-decimals",
      functionArgs: [],
      client: {
        baseUrl: rpc.client.baseUrl,
      },
      senderAddress: StacksZeroAddress
    })
    return Number(cvToValue(res).value)
  }

  static async getBalance<C extends StacksChains>(
    _network: Network,
    _chain: C,
    rpc: StacksNetwork,
    walletAddr: string,
    token: TokenAddress<C>,
  ): Promise<bigint | null> {
    if (isNative(token)) {
      const apiUrl = `${rpc.client.baseUrl}/extended/v1/address/${walletAddr}/stx`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch STX balance: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      if (typeof data.balance !== "string") {
        throw new Error("Invalid response: missing balance field");
      }
      return BigInt(data.balance);
    }
    const [contractAddress, contractName] = token.toString().split(".")
    if(!contractAddress || !contractName) {
      throw new Error("Invalid token address");
    }
    const res = await fetchCallReadOnlyFunction({
      contractName,
      contractAddress,
      functionName: "get-balance",
      functionArgs: [
        Cl.address(walletAddr)
      ],
      client: {
        baseUrl: rpc.client.baseUrl,
      },
      senderAddress: StacksZeroAddress
    })
    return BigInt(cvToValue(res).value)
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
    if(rpc.chainId == ChainId.Mainnet) {
      return ['Mainnet', 'Stacks'];
    }
    if(rpc.chainId == ChainId.Testnet) {
      if(rpc.client.baseUrl.includes('localhost') || rpc.client.baseUrl.includes('127.0.0.1')) {
        return ['Devnet', 'Stacks'];
      }
      return ['Testnet', 'Stacks'];
    }
    return ['Devnet', 'Stacks'];
  }

  static async waitForTx(txId: string | undefined, clientBaseUrl: string, debug: boolean = false) {
    if(!txId) {
      throw new Error("No tx id")
    }
    const apiUrl = `${clientBaseUrl}/extended/v1/tx/${txId}`
    const res = await fetch(apiUrl)
    let data = await res.json()
    let tries = 0
    while(data.tx_status !== 'success') {
      if(debug) console.log(`Waiting for tx ${txId} ... try: ${tries}`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      data = await fetch(apiUrl).then(res => res.json())
      tries++
    }
    if(debug) console.log(`tx mined!: ${txId}`)
  }
}
