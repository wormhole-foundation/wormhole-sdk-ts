import {
  ChainName,
  TokenId,
  TxHash,
  Platform,
  WormholeMessageId,
  SignedTx,
  TokenBridge,
  ChainsConfig,
  toNative,
  NativeAddress,
  networkPlatformConfigs,
  PlatformToChains,
  Network,
  DEFAULT_NETWORK,
  RpcConnection,
} from "@wormhole-foundation/connect-sdk";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmContracts } from "./contracts";
import { CosmwasmChain } from "./chain";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";
import {
  chainToNativeDenoms,
  cosmwasmChainIdToNetworkChainPair,
} from "./constants";
import { CosmwasmAddress } from "./address";

/**
 * @category Cosmwasm
 */
export module CosmwasmPlatform {
  export const platform = "Cosmwasm";
  export let network: Network = DEFAULT_NETWORK;
  export let conf: ChainsConfig = networkPlatformConfigs(network, platform);

  let contracts: CosmwasmContracts = new CosmwasmContracts(conf);

  type P = typeof platform;

  export function setConfig(
    network: Network,
    _conf?: ChainsConfig
  ): typeof CosmwasmPlatform {
    conf = _conf ? _conf : networkPlatformConfigs(network, platform);
    contracts = new CosmwasmContracts(conf);
    return CosmwasmPlatform;
  }

  export async function getRpc(chain: ChainName): Promise<CosmWasmClient> {
    const rpcAddress = conf[chain]!.rpc;
    return CosmWasmClient.connect(rpcAddress);
  }

  export function getChain(chain: ChainName): CosmwasmChain {
    return new CosmwasmChain(chain);
  }

  export async function getTokenBridge(
    rpc: CosmWasmClient
  ): Promise<CosmwasmTokenBridge> {
    return await CosmwasmTokenBridge.fromProvider(rpc, contracts);
  }

  export async function getDecimals(
    chain: ChainName,
    rpc: CosmWasmClient,
    token: TokenId | "native"
  ): Promise<bigint> {
    if (token === "native") return 6n;
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

    const tb = await getTokenBridge(rpc);
    const address = await tb.getWrappedAsset(tokenId);
    if (!address) return null;

    const { amount } = await rpc.getBalance(walletAddress, address.toString());
    return BigInt(amount);
  }

  function getNativeDenom(chain: ChainName): string {
    // TODO: required because of const map
    if (network === "Devnet") throw new Error("No devnet native denoms");

    return chainToNativeDenoms(network, chain as PlatformToChains<P>);
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

  export function parseAddress(
    chain: ChainName,
    address: string
  ): CosmwasmAddress {
    return toNative(chain, address) as CosmwasmAddress;
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

  export async function chainFromRpc(
    rpc: CosmWasmClient
  ): Promise<[Network, PlatformToChains<P>]> {
    const chainId = await rpc.getChainId();
    const networkChainPair = cosmwasmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown Cosmwasm chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return [network, chain];
  }
}
