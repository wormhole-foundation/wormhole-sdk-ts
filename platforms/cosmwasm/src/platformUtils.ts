import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  Network,
  PlatformToChains,
  WormholeMessageId,
  nativeDecimals,
  chainToPlatform,
  PlatformUtils,
  UniversalOrNative,
} from "@wormhole-foundation/connect-sdk";
import {
  IBC_TRANSFER_PORT,
  chainToNativeDenoms,
  cosmwasmChainIdToNetworkChainPair,
} from "./constants";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmPlatform } from "./platform";
import { CosmwasmAddress } from "./address";
import { IbcExtension, QueryClient, setupIbcExtension } from "@cosmjs/stargate";

// forces CosmwasmUtils to implement PlatformUtils
var _: PlatformUtils<"Cosmwasm"> = CosmwasmUtils;

/**
 * @category CosmWasm
 */
// Provides runtime concrete value
export module CosmwasmUtils {
  export function nativeTokenId(chain: ChainName): TokenId {
    if (!isSupportedChain(chain))
      throw new Error(`invalid chain for CosmWasm: ${chain}`);
    return {
      chain: chain,
      // TODO
      // @ts-ignore
      address: new CosmwasmAddress(getNativeDenom(chain)),
    };
  }

  export function isSupportedChain(chain: ChainName): boolean {
    const platform = chainToPlatform(chain);
    return platform === CosmwasmPlatform.platform;
  }

  export function isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean {
    if (!isSupportedChain(chain)) return false;
    if (tokenId.chain !== chain) return false;
    const native = nativeTokenId(chain);
    return native == tokenId;
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: CosmWasmClient,
    token: UniversalOrNative<"Cosmwasm"> | "native",
  ): Promise<bigint> {
    if (token === "native") return nativeDecimals(CosmwasmPlatform.platform);

    const { decimals } = await rpc.queryContractSmart(token.toString(), {
      token_info: {},
    });
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: CosmWasmClient,
    walletAddress: string,
    token: UniversalOrNative<"Cosmwasm"> | "native",
  ): Promise<bigint | null> {
    if (token === "native") {
      const { amount } = await rpc.getBalance(
        walletAddress,
        getNativeDenom(chain),
      );
      return BigInt(amount);
    }

    const { amount } = await rpc.getBalance(walletAddress, token.toString());
    return BigInt(amount);
  }

  function getNativeDenom(chain: ChainName): string {
    // TODO: required because of const map
    if (CosmwasmPlatform.network === "Devnet")
      throw new Error("No devnet native denoms");

    return chainToNativeDenoms(
      CosmwasmPlatform.network,
      chain as PlatformToChains<CosmwasmPlatform.Type>,
    );
  }

  export function isNativeDenom(chain: ChainName, denom: string): boolean {
    return denom === getNativeDenom(chain);
  }

  export async function sendWait(
    chain: ChainName,
    rpc: CosmWasmClient,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];
    for (const stxn of stxns) {
      const result = await rpc.broadcastTx(stxn);
      if (result.code !== 0)
        throw new Error(
          `Error sending transaction (${result.transactionHash}): ${result.rawLog}`,
        );
      txhashes.push(result.transactionHash);
    }
    return txhashes;
  }

  export async function getCurrentBlock(rpc: CosmWasmClient): Promise<number> {
    return rpc.getHeight();
  }

  export async function chainFromRpc(
    rpc: CosmWasmClient,
  ): Promise<[Network, PlatformToChains<CosmwasmPlatform.Type>]> {
    const chainId = await rpc.getChainId();
    const networkChainPair = cosmwasmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown Cosmwasm chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }

  export async function getCounterpartyChannel(
    sourceChannel: string,
    rpc: CosmWasmClient,
  ): Promise<string | null> {
    const queryClient = asQueryClient(rpc);
    const conn = await queryClient.ibc.channel.channel(
      IBC_TRANSFER_PORT,
      sourceChannel,
    );
    return conn.channel?.counterparty?.channelId ?? null;
  }

  export const asQueryClient = (
    rpc: CosmWasmClient,
  ): QueryClient & IbcExtension => {
    // @ts-ignore
    const tmClient: TendermintClient = rpc.getTmClient()!;
    return QueryClient.withExtensions(tmClient, setupIbcExtension);
  };
}
