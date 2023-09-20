import {
  ChainName,
  PlatformName,
  chainToPlatform,
} from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  Platform,
  TxHash,
  RpcConnection,
  TokenId,
  AutomaticTokenBridge,
  TokenBridge,
  UniversalAddress,
  WormholeMessageId,
  CircleBridge,
  AutomaticCircleBridge,
  ChainsConfig,
  toNative,
  nativeIsRegistered,
  NativeAddress,
} from "../..";
import { MockRpc } from "./rpc";
import { MockChain } from "./chain";
import { MockTokenBridge } from "./tokenBridge";
import { WormholeCore } from "../../protocols/core";

// TODO: how tf is this gonna work?
export function mockPlatformFactory<P extends "Evm">(p: P): Platform<"Evm"> {
  return MockPlatform;
}

module MockPlatform {
  export const platform: "Evm" = "Evm";
  export let conf: ChainsConfig;

  export type P = typeof platform;

  export function init(_conf: ChainsConfig): Platform<P> {
    conf = _conf;
    return MockPlatform;
  }
  export function getDecimals(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId | "native"
  ): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  export function getBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId | "native"
  ): Promise<bigint | null> {
    throw new Error("Method not implemented.");
  }

  export function getChain(chain: ChainName): ChainContext<P> {
    return new MockChain<P>(MockPlatform, chain);
  }
  export function getRpc(chain: ChainName): RpcConnection<P> {
    // @ts-ignore
    return new MockRpc(chain);
  }

  export async function getWrappedAsset(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId
  ): Promise<TokenId | null> {
    throw new Error("Method not implemented.");
  }
  export async function getTokenDecimals(
    rpc: RpcConnection<P>,
    token: TokenId
  ): Promise<bigint> {
    return 8n;
  }
  export async function getNativeBalance(
    rpc: RpcConnection<P>,
    walletAddr: string
  ): Promise<bigint> {
    return 0n;
  }
  export async function getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId
  ): Promise<bigint | null> {
    return 10n;
  }

  export async function parseTransaction(
    chain: ChainName,
    rpc: RpcConnection<P>,
    txid: TxHash
  ): Promise<WormholeMessageId[]> {
    throw new Error("Method not implemented");
  }

  export function parseAddress(
    chain: ChainName,
    address: string
  ): NativeAddress<P> {
    if (!nativeIsRegistered(chain)) throw new Error("Chain not registered");
    //@ts-ignore
    return toNative(chain, address).toUniversalAddress();
  }

  export async function sendWait(
    chain: ChainName,
    rpc: RpcConnection<P>,
    stxns: any[]
  ): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  export async function getWormholeCore(
    rpc: RpcConnection<P>
  ): Promise<WormholeCore<P>> {
    throw new Error("Method not implemented.");
  }
  export async function getTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<TokenBridge<P>> {
    // @ts-ignore
    return new MockTokenBridge<P>(rpc);
  }

  export async function getAutomaticTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticTokenBridge<P>> {
    throw new Error("Method not implemented.");
  }
  export async function getCircleBridge(
    rpc: RpcConnection<P>
  ): Promise<CircleBridge<P>> {
    throw new Error("Method not implemented.");
  }
  export async function getCircleRelayer(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>> {
    throw new Error("Method Not implemented.");
  }
  export async function getAutomaticCircleBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>> {
    throw new Error("Method not implemented.");
  }
}
