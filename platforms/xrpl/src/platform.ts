import {
  ChainContext,
  ChainsConfig,
  chainToPlatform,
  ChainToPlatform,
  Network,
  networkPlatformConfigs,
  PlatformContext,
  RpcConnection,
  StaticPlatformMethods,
  TokenId,
  TxHash,
  SignedTx,
  isNative,
  decimals,
  TokenAddress,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";
import { Chain } from "@wormhole-foundation/sdk-connect";
import { _platform, XrplChains, XrplPlatformType } from "./types.js";
import { XrplChain } from "./chain.js";
import { XrplZeroAddress } from "./address.js";
import { Client } from "xrpl";

export class XrplPlatform<N extends Network>
  extends PlatformContext<N, XrplPlatformType>
  implements StaticPlatformMethods<XrplPlatformType, typeof XrplPlatform>
{
  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, XrplPlatformType>) {
    super(
      network,
      config ?? networkPlatformConfigs(network, XrplPlatform._platform),
    );
  }

  override getRpc<C extends XrplChains>(chain: C): Client {
    const rpcUrl = this.config[chain]!.rpc;
    return new Client(rpcUrl);
  }

  override getChain<C extends XrplChains>(
    chain: C,
    rpc?: RpcConnection<C>,
  ): ChainContext<N, C, ChainToPlatform<C>> {
    if (chain in this.config) {
      return new XrplChain<N, C>(chain, this, rpc);
    }
    throw new Error("No configuration available for chain: " + chain);
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === XrplPlatform._platform;
  }

  static nativeTokenId<N extends Network, C extends XrplChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    if (!XrplPlatform.isSupportedChain(chain)) {
      throw new Error(`invalid chain for Xrpl: ${chain}`);
    }
    return Wormhole.tokenId(chain, XrplZeroAddress);
  }

  static isNativeTokenId<N extends Network, C extends XrplChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!XrplPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    return tokenId.address.toString() === XrplZeroAddress;
  }

  static async getDecimals<C extends XrplChains>(
    _network: Network,
    _chain: C,
    _rpc: RpcConnection<C>,
    token: TokenAddress<C>,
  ): Promise<number> {
    if (isNative(token))
      return decimals.nativeDecimals(XrplPlatform._platform);
    throw new Error("Token decimals lookup not yet implemented for XRPL");
  }

  static async getBalance<C extends XrplChains>(
    _network: Network,
    _chain: C,
    rpc: Client,
    walletAddr: string,
    token: TokenAddress<C>,
  ): Promise<bigint | null> {
    if (isNative(token)) {
      if (!rpc.isConnected()) await rpc.connect();
      try {
        const response = await rpc.request({
          command: "account_info",
          account: walletAddr,
          ledger_index: "validated",
        });
        return BigInt(response.result.account_data.Balance);
      } finally {
        if (rpc.isConnected()) await rpc.disconnect();
      }
    }
    throw new Error("Token balance lookup not yet implemented for XRPL");
  }

  static async getLatestBlock<C extends XrplChains>(
    rpc: RpcConnection<C>,
  ): Promise<number> {
    throw new Error("Method not implemented.");
  }

  static async getLatestFinalizedBlock<C extends XrplChains>(
    rpc: RpcConnection<C>,
  ): Promise<number> {
    throw new Error("Method not implemented.");
  }

  static async sendWait<C extends XrplChains>(
    chain: C,
    rpc: RpcConnection<C>,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  static chainFromChainId(chainId: string): [Network, XrplChains] {
    throw new Error("Method not implemented.");
  }

  static async chainFromRpc(rpc: Client): Promise<[Network, XrplChains]> {
    if (!rpc.isConnected()) await rpc.connect();
    try {
      const response = await rpc.request({
        command: "server_info",
      });
      const networkId = response.result.info.network_id;
      if (networkId === 0 || networkId === undefined) {
        return ["Mainnet", "Xrpl"];
      }
      return ["Testnet", "Xrpl"];
    } finally {
      if (rpc.isConnected()) await rpc.disconnect();
    }
  }
}
