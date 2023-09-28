import {
  ChainName,
  TokenId,
  TxHash,
  SignedTx,
  Network,
  PlatformToChains,
  WormholeMessageId,
  nativeDecimals,
} from '@wormhole-foundation/connect-sdk';
import { chainToNativeDenoms, cosmwasmChainIdToNetworkChainPair } from './constants';
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmPlatform } from './platform';

/**
 * @category CosmWasm
 */
// Provides runtime concrete value
export module CosmwasmUtils {
  export async function getDecimals(
    chain: ChainName,
    rpc: CosmWasmClient,
    token: TokenId | "native"
  ): Promise<bigint> {
    if (token === "native") return nativeDecimals(CosmwasmPlatform.platform);
    const { decimals } = await rpc.queryContractSmart(
      token.address.toString(),
      {
        token_info: {},
      }
    );
    return decimals;
  }

  export async function getBalance(
    chain: ChainName,
    rpc: CosmWasmClient,
    walletAddress: string,
    tokenId: TokenId | "native"
  ): Promise<bigint | null> {
    if (tokenId === "native") {
      const { amount } = await rpc.getBalance(
        walletAddress,
        getNativeDenom(chain)
      );
      return BigInt(amount);
    }

    const { amount } = await rpc.getBalance(walletAddress, tokenId.address.toString());
    return BigInt(amount);
  }

  function getNativeDenom(chain: ChainName): string {
    // TODO: required because of const map
    if (CosmwasmPlatform.network === "Devnet") throw new Error("No devnet native denoms");

    return chainToNativeDenoms(CosmwasmPlatform.network, chain as PlatformToChains<CosmwasmPlatform.Type>);
  }

  export async function sendWait(
    chain: ChainName,
    rpc: CosmWasmClient,
    stxns: SignedTx[]
  ): Promise<TxHash[]> {
    throw new Error("Not implemented");
    //const txhashes: TxHash[] = [];

    //for (const stxn of stxns) {
    //  const txRes = await rpc.broadcastTransaction(stxn);
    //  txhashes.push(txRes.hash);

    //  if (chain === "Celo") {
    //    console.error("TODO: override celo block fetching");
    //    continue;
    //  }

    //  // Wait for confirmation
    //  const txReceipt = await txRes.wait();
    //  if (txReceipt === null) continue; // TODO: throw error?
    //}
    //return txhashes;
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: CosmWasmClient,
    txid: TxHash
  ): Promise<WormholeMessageId[]> {
    throw new Error("Not implemented");
    //const receipt = await rpc.getTransactionReceipt(txid);

    //if (receipt === null)
    //  throw new Error(`No transaction found with txid: ${txid}`);

    //const coreAddress = this.conf[chain]!.contracts.coreBridge;
    //const coreImpl = this.contracts.getCoreImplementationInterface();

    //return receipt.logs
    //  .filter((l: any) => {
    //    return l.address === coreAddress;
    //  })
    //  .map((log) => {
    //    const { topics, data } = log;
    //    const parsed = coreImpl.parseLog({ topics: topics.slice(), data });
    //    if (parsed === null) return undefined;

    //    const emitterAddress = this.parseAddress(chain, parsed.args.sender);
    //    return {
    //      chain: chain,
    //      emitter: emitterAddress.toUniversalAddress(),
    //      sequence: parsed.args.sequence,
    //    } as WormholeMessageId;
    //  })
    //  .filter(isWormholeMessageId);
  }

  export async function getCurrentBlock(rpc: CosmWasmClient): Promise<number> {
    return rpc.getHeight();
  }

  export async function chainFromRpc(
    rpc: CosmWasmClient
  ): Promise<[Network, PlatformToChains<CosmwasmPlatform.Type>]> {
    const chainId = await rpc.getChainId();
    const networkChainPair = cosmwasmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown Cosmwasm chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }
}
