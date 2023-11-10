import { Chain, Network, Platform, PlatformToChains, ProtocolName } from "@wormhole-foundation/sdk-base";
import {
  AutomaticCircleBridge,
  AutomaticTokenBridge,
  Balances,
  ChainContext,
  ChainsConfig,
  CircleBridge,
  PlatformContext,
  ProtocolInitializer,
  RpcConnection,
  TokenAddress,
  TokenBridge,
  TokenId,
  TxHash,
  WormholeMessageId
} from "../..";
import { WormholeCore } from "../../protocols/core";
import { MockChain } from "./chain";
import { MockRpc } from "./rpc";
import { MockTokenBridge } from "./tokenBridge";

export function mockPlatformFactory<N extends Network, P extends Platform>(
  network: N,
  p: P,
  config: ChainsConfig<N, P>,
): PlatformContext<N, P> {
  class ConcreteMockPlatform extends MockPlatform<N, P> {
    static _platform = p;

    static getProtocolInitializer<PN extends ProtocolName>(protocol: PN): ProtocolInitializer<P, PN> {
      throw new Error("Method not implemented.");
    }
  }

  return new ConcreteMockPlatform(network, config);
}

// Note: don't use this directly, instead create a ConcreteMockPlatform with the
// mockPlatformFactory
export class MockPlatform<N extends Network, P extends Platform> implements PlatformContext<N, P> {

  readonly platform: P;

  network: N;
  config: ChainsConfig<N, P>;

  constructor(network: N, config: ChainsConfig<N, P>) {
    this.network = network;
    this.config = config;
  }

  Platform(): P {
    throw new Error("Method not implemented.");
  }

  setConfig<NN extends Network>(network: NN, _conf: ChainsConfig<NN, P>): MockPlatform<NN, P> {
    return new MockPlatform<NN, P>(network, _conf);
  }


  getProtocol<PN extends ProtocolName, T extends any>(protocol: PN): T {
    throw new Error("Method not implemented.");
  }

  nativeTokenId<C extends PlatformToChains<P>>(chain: C): TokenId<C> {
    throw new Error("Method not implemented.");
  }

  isNativeTokenId<C extends PlatformToChains<P>>(chain: C, tokenId: TokenId<C>): boolean {
    throw new Error("Method not implemented.");
  }

  isSupportedChain(chain: Chain): boolean {
    throw new Error("Method not implemented.");
  }

  getDecimals<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    token: TokenAddress<P>,
  ): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  getBalance<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenAddress<P>,
  ): Promise<bigint | null> {
    throw new Error("Method not implemented.");
  }

  getBalances<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<Platform>,
    walletAddress: string,
    tokens: TokenAddress<P>[],
  ): Promise<Balances> {
    throw new Error("method not implemented");
  }

  getChain<C extends Chain>(chain: C): ChainContext<N, C, P> {
    if (chain in this.config) return new MockChain<N, C, P>(this.config[chain]!);

    throw new Error("No configuration available for chain: " + chain);
  }

  getRpc<C extends PlatformToChains<P>>(chain: C): RpcConnection<P> {
    return new MockRpc(chain);
  }

  getCurrentBlock(rpc: any): Promise<number> {
    throw new Error("Method not implemented");
  }

  async getWrappedAsset<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    token: TokenId<C>,
  ): Promise<TokenId<C> | null> {
    throw new Error("Method not implemented.");
  }
  async getTokenDecimals(
    rpc: RpcConnection<P>,
    token: TokenId<PlatformToChains<P>>,
  ): Promise<bigint> {
    return 8n;
  }
  async getNativeBalance(rpc: RpcConnection<P>, walletAddr: string): Promise<bigint> {
    return 0n;
  }
  async getTokenBalance<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId<C>,
  ): Promise<bigint | null> {
    return 10n;
  }

  async parseTransaction<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    throw new Error("Method not implemented");
  }

  chainFromChainId(chainId: string): [Network, Chain] {
    throw new Error("Not implemented");
  }
  async chainFromRpc(rpc: RpcConnection<P>): Promise<[Network, Chain]> {
    throw new Error("Not implemented");
  }

  async sendWait(chain: Chain, rpc: RpcConnection<P>, stxns: any[]): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  async getWormholeCore(rpc: RpcConnection<P>): Promise<WormholeCore<P>> {
    throw new Error("Method not implemented.");
  }
  async getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>> {
    return new MockTokenBridge<P>(rpc);
  }

  async getAutomaticTokenBridge(rpc: RpcConnection<P>): Promise<AutomaticTokenBridge<P>> {
    throw new Error("Method not implemented.");
  }
  async getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>> {
    throw new Error("Method not implemented.");
  }
  async getCircleRelayer(rpc: RpcConnection<P>): Promise<AutomaticCircleBridge<P>> {
    throw new Error("Method Not implemented.");
  }
  async getAutomaticCircleBridge(rpc: RpcConnection<P>): Promise<AutomaticCircleBridge<P>> {
    throw new Error("Method not implemented.");
  }
}
