import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  BankExtension,
  IbcExtension,
  QueryClient,
  setupBankExtension,
  setupIbcExtension,
} from "@cosmjs/stargate";

import {
  Chain,
  ChainsConfig,
  Network,
  PlatformContext,
  SignedTx,
  TxHash,
  Wormhole,
  decimals,
  nativeChainIds,
  networkPlatformConfigs,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmChain } from "./chain";
import { IbcChannels, chainToNativeDenoms, networkChainToChannels } from "./constants";
import { CosmwasmChains, CosmwasmPlatformType, _platform } from "./types";

import { Balances, TokenId, chainToPlatform } from "@wormhole-foundation/connect-sdk";
import { CosmwasmAddress } from "./address";
import { IBC_TRANSFER_PORT } from "./constants";
import { AnyCosmwasmAddress } from "./types";

/**
 * @category Cosmwasm
 */
export class CosmwasmPlatform<N extends Network> extends PlatformContext<N, CosmwasmPlatformType> {
  static _platform: CosmwasmPlatformType = _platform;

  constructor(network: N, _config?: ChainsConfig<N, CosmwasmPlatformType>) {
    super(network, _config ?? networkPlatformConfigs(network, CosmwasmPlatform._platform));
  }

  // export const {
  //   getRpc: getGatewayRpc,
  //   getWrappedAsset: getGatewayWrappedAsset,
  //   gatewayAddress,
  //   getGatewaySourceChannel,
  // } = Gateway;

  async getRpc<C extends CosmwasmChains>(chain: C): Promise<CosmWasmClient> {
    if (chain in this.config) return await CosmWasmClient.connect(this.config[chain]!.rpc);
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends CosmwasmChains>(chain: C, rpc?: CosmWasmClient): CosmwasmChain<N, C> {
    if (chain in this.config) return new CosmwasmChain<N, C>(chain, this, rpc);
    throw new Error("No configuration available for chain: " + chain);
  }

  static getQueryClient = (rpc: CosmWasmClient): QueryClient & BankExtension & IbcExtension => {
    return QueryClient.withExtensions(rpc["cometClient"], setupBankExtension, setupIbcExtension);
  };

  // cached channels from config if available
  static getIbcChannels<N extends Network, C extends CosmwasmChains>(
    network: N,
    chain: C,
  ): IbcChannels | null {
    return networkChainToChannels.has(network, chain)
      ? networkChainToChannels.get(network, chain)!
      : null;
  }

  static nativeTokenId<C extends CosmwasmChains>(network: Network, chain: C): TokenId<C> {
    if (!this.isSupportedChain(chain)) throw new Error(`invalid chain for CosmWasm: ${chain}`);
    return Wormhole.chainAddress(chain, this.getNativeDenom(network, chain));
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === CosmwasmPlatform._platform;
  }

  static isNativeTokenId<N extends Network, C extends CosmwasmChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!this.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = this.nativeTokenId(network, chain);
    return native == tokenId;
  }

  static async getDecimals<C extends CosmwasmChains>(
    chain: C,
    rpc: CosmWasmClient,
    token: AnyCosmwasmAddress | "native",
  ): Promise<bigint> {
    if (token === "native") return BigInt(decimals.nativeDecimals(CosmwasmPlatform._platform));

    const addrStr = new CosmwasmAddress(token).toString();
    const { decimals: numDecimals } = await rpc.queryContractSmart(addrStr, {
      token_info: {},
    });
    return numDecimals;
  }

  static async getBalance<C extends CosmwasmChains>(
    chain: C,
    rpc: CosmWasmClient,
    walletAddress: string,
    token: AnyCosmwasmAddress | "native",
  ): Promise<bigint | null> {
    if (token === "native") {
      const [network, _] = await CosmwasmPlatform.chainFromRpc(rpc);
      const { amount } = await rpc.getBalance(walletAddress, this.getNativeDenom(network, chain));
      return BigInt(amount);
    }

    const addrStr = new CosmwasmAddress(token).toString();
    const { amount } = await rpc.getBalance(walletAddress, addrStr);
    return BigInt(amount);
  }

  static async getBalances<C extends CosmwasmChains>(
    chain: C,
    rpc: CosmWasmClient,
    walletAddress: string,
    tokens: (AnyCosmwasmAddress | "native")[],
  ): Promise<Balances> {
    const client = CosmwasmPlatform.getQueryClient(rpc);
    const allBalances = await client.bank.allBalances(walletAddress);
    const [network, _] = await CosmwasmPlatform.chainFromRpc(rpc);
    const balancesArr = tokens.map((token) => {
      const address =
        token === "native"
          ? this.getNativeDenom(network, chain)
          : new CosmwasmAddress(token).toString();
      const balance = allBalances.find((balance) => balance.denom === address);
      const balanceBigInt = balance ? BigInt(balance.amount) : null;
      return { [address]: balanceBigInt };
    });

    return balancesArr.reduce((obj, item) => Object.assign(obj, item), {});
  }

  static getNativeDenom<N extends Network, C extends CosmwasmChains>(network: N, chain: C): string {
    return chainToNativeDenoms.get(network, chain)!;
  }

  static async sendWait(chain: Chain, rpc: CosmWasmClient, stxns: SignedTx[]): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    for (const stxn of stxns) {
      const result = await rpc.broadcastTx(stxn);
      if (result.code !== 0)
        throw new Error(`Error sending transaction (${result.transactionHash}): ${result.rawLog}`);
      txhashes.push(result.transactionHash);
    }
    return txhashes;
  }

  static async getLatestBlock(rpc: CosmWasmClient): Promise<number> {
    return rpc.getHeight();
  }
  static async getLatestFinalizedBlock(rpc: CosmWasmClient): Promise<number> {
    throw new Error("not implemented");
  }

  static chainFromChainId(chainMoniker: string): [Network, CosmwasmChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      CosmwasmPlatform._platform,
      chainMoniker,
    );

    if (networkChainPair === undefined) throw new Error(`Unknown Cosmwasm chainId ${chainMoniker}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(rpc: CosmWasmClient): Promise<[Network, CosmwasmChains]> {
    const chainId = await rpc.getChainId();
    return this.chainFromChainId(chainId);
  }

  static async getCounterpartyChannel(
    sourceChannel: string,
    rpc: CosmWasmClient,
  ): Promise<string | null> {
    const queryClient = CosmwasmPlatform.getQueryClient(rpc);
    const conn = await queryClient.ibc.channel.channel(IBC_TRANSFER_PORT, sourceChannel);
    return conn.channel?.counterparty?.channelId ?? null;
  }
}
