import {
  ChainName,
  Network,
  PlatformName,
} from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  Platform,
  TxHash,
  RpcConnection,
  TokenId,
  AutomaticTokenBridge,
  TokenBridge,
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

export function mockPlatformFactory<P extends PlatformName>(
  network: Network,
  p: P,
  config: ChainsConfig,
): Platform<P> {
  class ConcreteMockPlatform extends MockPlatform<P> {
    readonly platform = p;
  }
  return new ConcreteMockPlatform(network, config);
}

// Note: don't use this directly, instead create a ConcreteMockPlatform with the
// mockPlatformFactory
export class MockPlatform<P extends PlatformName> implements Platform<P> {
  // @ts-ignore
  readonly platform: P;
  readonly nativeDecimals = 18n;

  network: Network;
  conf: ChainsConfig;

  constructor(network: Network, conf: ChainsConfig) {
    this.network = network;
    this.conf = conf;
  }

  setConfig(network: Network, _conf: ChainsConfig): MockPlatform<P> {
    this.network = network;
    this.conf = _conf;
    return this;
  }

  getDecimals(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId | "native"
  ): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  getBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId | "native"
  ): Promise<bigint | null> {
    throw new Error("Method not implemented.");
  }

  getChain(chain: ChainName): ChainContext<P> {
    return new MockChain<P>(this.network, this.platform, chain);
  }
  getRpc(chain: ChainName): RpcConnection<P> {
    // @ts-ignore
    return new MockRpc(chain);
  }
  getCurrentBlock(rpc: any): Promise<number> {
    throw new Error("Method not implemented");
  }

  async getWrappedAsset(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId
  ): Promise<TokenId | null> {
    throw new Error("Method not implemented.");
  }
  async getTokenDecimals(
    rpc: RpcConnection<P>,
    token: TokenId
  ): Promise<bigint> {
    return 8n;
  }
  async getNativeBalance(
    rpc: RpcConnection<P>,
    walletAddr: string
  ): Promise<bigint> {
    return 0n;
  }
  async getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId
  ): Promise<bigint | null> {
    return 10n;
  }

  async parseTransaction(
    chain: ChainName,
    rpc: RpcConnection<P>,
    txid: TxHash
  ): Promise<WormholeMessageId[]> {
    throw new Error("Method not implemented");
  }

  async chainFromRpc(rpc: RpcConnection<P>): Promise<[Network, ChainName]> {
    throw new Error("Not implemented");
  }

  parseAddress(chain: ChainName, address: string): NativeAddress<P> {
    if (!nativeIsRegistered(chain)) throw new Error("Chain not registered");
    //@ts-ignore
    return toNative(chain, address).toUniversalAddress();
  }

  async sendWait(
    chain: ChainName,
    rpc: RpcConnection<P>,
    stxns: any[]
  ): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  async getWormholeCore(rpc: RpcConnection<P>): Promise<WormholeCore<P>> {
    throw new Error("Method not implemented.");
  }
  async getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>> {
    // @ts-ignore
    return new MockTokenBridge<P>(rpc);
  }

  async getAutomaticTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticTokenBridge<P>> {
    throw new Error("Method not implemented.");
  }
  async getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>> {
    throw new Error("Method not implemented.");
  }
  async getCircleRelayer(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>> {
    throw new Error("Method Not implemented.");
  }
  async getAutomaticCircleBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticCircleBridge<P>> {
    throw new Error("Method not implemented.");
  }
}
