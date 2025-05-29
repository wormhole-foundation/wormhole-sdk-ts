import type {
  Chain,
  ChainsConfig,
  Network,
  SignedTx,
  StaticPlatformMethods,
  TokenId,
  TxHash,
} from "@wormhole-foundation/sdk-connect";
import {
  PlatformContext,
  Wormhole,
  chainToPlatform,
  decimals,
  isNative,
  nativeChainIds,
  networkPlatformConfigs,
} from "@wormhole-foundation/sdk-connect";
import type { SignedTransaction } from "algosdk";
import algosdk from "algosdk";
import { AlgorandAddress, AlgorandZeroAddress } from "./address.js";
import { AlgorandChain } from "./chain.js";
import type { AlgorandChains, AlgorandPlatformType, AnyAlgorandAddress } from "./types.js";
import { _platform } from "./types.js";

/**
 * @category Algorand
 */
export class AlgorandPlatform<N extends Network>
  extends PlatformContext<N, AlgorandPlatformType>
  implements StaticPlatformMethods<AlgorandPlatformType, typeof AlgorandPlatform>
{
  static _platform = _platform;

  constructor(network: N, _config?: ChainsConfig<N, AlgorandPlatformType>) {
    super(network, _config ?? networkPlatformConfigs(network, AlgorandPlatform._platform));
  }

  getRpc<C extends AlgorandChains>(chain: C): algosdk.Algodv2 {
    if (chain in this.config) return new algosdk.Algodv2("", this.config[chain]!.rpc);
    throw new Error("No configuration available for chain: " + chain);
  }

  getChain<C extends AlgorandChains>(chain: C): AlgorandChain<N, C> {
    if (chain in this.config) return new AlgorandChain(chain, this);
    throw new Error("No configuration available for chain: " + chain);
  }

  static nativeTokenId<N extends Network, C extends AlgorandChains>(
    network: N,
    chain: C,
  ): TokenId<C> {
    if (!AlgorandPlatform.isSupportedChain(chain))
      throw new Error(`invalid chain for Algorand: ${chain}`);
    return Wormhole.chainAddress(chain, AlgorandZeroAddress);
  }

  static isNativeTokenId<N extends Network, C extends AlgorandChains>(
    network: N,
    chain: C,
    tokenId: TokenId,
  ): boolean {
    if (!AlgorandPlatform.isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = this.nativeTokenId(network, chain);
    return native == tokenId;
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === AlgorandPlatform._platform;
  }

  static async getDecimals(
    network: Network,
    chain: Chain,
    rpc: algosdk.Algodv2,
    token: AnyAlgorandAddress,
  ): Promise<number> {
    // It may come in as a universal address
    const assetId = isNative(token) ? 0 : new AlgorandAddress(token).toInt();

    if (assetId === 0) return decimals.nativeDecimals(AlgorandPlatform._platform);

    const assetResp = await rpc.getAssetByID(assetId).do();
    const asset = algosdk.modelsv2.Asset.from_obj_for_encoding(assetResp);
    if (!asset.params || !asset.params.decimals) throw new Error("Could not fetch token details");
    return Number(asset.params.decimals);
  }

  static async getBalance(
    network: Network,
    chain: Chain,
    rpc: algosdk.Algodv2,
    walletAddr: string,
    token: AnyAlgorandAddress,
  ): Promise<bigint | null> {
    const assetId = isNative(token) ? 0 : new AlgorandAddress(token).toInt();
    if (assetId === 0) {
      const resp = await rpc.accountInformation(walletAddr).do();
      const accountInfo = algosdk.modelsv2.Account.from_obj_for_encoding(resp);
      return BigInt(accountInfo.amount);
    }

    const acctAssetInfoResp = await rpc.accountAssetInformation(walletAddr, assetId).do();
    const accountAssetInfo = algosdk.modelsv2.AssetHolding.from_obj_for_encoding(acctAssetInfoResp);
    return BigInt(accountAssetInfo.amount);
  }

  static async sendWait(chain: Chain, rpc: algosdk.Algodv2, stxns: SignedTx[]): Promise<TxHash[]> {
    const rounds = 4;

    const decodedStxns: SignedTransaction[] = stxns.map((val, idx) => {
      const decodedStxn: SignedTransaction = algosdk.decodeSignedTransaction(val);
      return decodedStxn;
    });

    const txIds: string[] = decodedStxns.map((val, idx) => {
      const id: string = val.txn.txID();
      return id;
    });

    const { txId } = await rpc.sendRawTransaction(stxns).do();
    if (!txId) {
      throw new Error("Transaction(s) failed to send");
    }
    const confirmResp = await algosdk.waitForConfirmation(rpc, txId, rounds);
    const ptr = algosdk.modelsv2.PendingTransactionResponse.from_obj_for_encoding(confirmResp);
    if (!ptr.confirmedRound) {
      throw new Error(`Transaction(s) could not be confirmed in ${rounds} rounds`);
    }

    return txIds;
  }

  static async getLatestBlock(rpc: algosdk.Algodv2): Promise<number> {
    const statusResp = await rpc.status().do();
    const status = algosdk.modelsv2.NodeStatusResponse.from_obj_for_encoding(statusResp);
    if (!status.lastRound) {
      throw new Error("Error getting status from node");
    }
    return Number(status.lastRound);
  }

  static async getLatestFinalizedBlock(rpc: algosdk.Algodv2): Promise<number> {
    const statusResp = await rpc.status().do();
    const status = algosdk.modelsv2.NodeStatusResponse.from_obj_for_encoding(statusResp);
    if (!status.lastRound) {
      throw new Error("Error getting status from node");
    }
    return Number(status.lastRound);
  }

  static chainFromChainId(genesisId: string): [Network, AlgorandChains] {
    const networkChainPair = nativeChainIds.platformNativeChainIdToNetworkChain(
      AlgorandPlatform._platform,
      genesisId,
    );

    if (networkChainPair === undefined) throw new Error(`Unknown native chain id ${genesisId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  static async chainFromRpc(rpc: algosdk.Algodv2): Promise<[Network, AlgorandChains]> {
    const versionResp = await rpc.versionsCheck().do();
    const version = algosdk.modelsv2.Version.from_obj_for_encoding(versionResp);
    return this.chainFromChainId(version.genesisId);
  }
}
