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
} from "@wormhole-foundation/connect-sdk";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmwasmContracts } from "./contracts";
import { CosmwasmChain } from "./chain";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";
import { chainToNativeDenoms } from "./constants";

/**
 * @category Cosmwasm
 */
export module CosmwasmPlatform {
  // Provides runtime concrete value
  export const platform = "Cosmwasm";
  type P = typeof platform;

  export let conf: ChainsConfig = networkPlatformConfigs("Testnet", platform);
  let contracts: CosmwasmContracts = new CosmwasmContracts(conf);

  export function setConfig(_conf: ChainsConfig): Platform<P> {
    conf = _conf;
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
  ): Promise<TokenBridge<P>> {
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
    //throw new Error("Not implemented");

    //TODO:
    //  const assetAddress = await this.getForeignAsset(tokenId, chain);
    //  if (!assetAddress) return null;
    //  return this.getNativeBalance(walletAddress, chain, assetAddress);

    const asset =
      tokenId === "native" ? getNativeDenom(chain) : tokenId.address.toString();
    const { amount } = await rpc.getBalance(walletAddress, asset);
    return BigInt(amount);
  }

  function getNativeDenom(chain: ChainName): string {
    // TODO: fixme
    const network = "Testnet";
    return chainToNativeDenoms(network, chain as PlatformToChains<"Cosmwasm">);
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
  ): NativeAddress<P> {
    return toNative(chain, address) as NativeAddress<P>;
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
}
