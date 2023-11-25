import {
  Chain,
  Network,
  Platform,
  PlatformToChains,
  ProtocolName,
} from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  ChainsConfig,
  PlatformContext,
  PlatformUtils,
  RpcConnection,
  TokenAddress,
  TokenId,
} from "../..";
import { MockChain } from "./chain";
import { MockRpc } from "./rpc";

export function mockPlatformFactory<N extends Network, P extends Platform>(
  platform: P,
  config: ChainsConfig<N, P>,
): PlatformUtils<N, P> {
  class ConcreteMockPlatform extends MockPlatform<N, P> {
    static _platform: P = platform;
    constructor(network: N, _config?: ChainsConfig<N, P>) {
      super(network, _config ? _config : config);
    }
  }
  // @ts-ignore
  return ConcreteMockPlatform;
}

// Note: don't use this directly, instead create a ConcreteMockPlatform with the
// mockPlatformFactory
export class MockPlatform<N extends Network, P extends Platform> extends PlatformContext<N, P> {
  constructor(network: N, config: ChainsConfig<N, P>) {
    super(network, config);
  }

  static getProtocol<PN extends ProtocolName, T extends any>(protocol: PN): T {
    throw new Error("Method not implemented.");
  }

  // static nativeTokenId<C extends PlatformToChains<P>>(chain: C): TokenId<C> {
  //   throw new Error("Method not implemented.");
  // }

  // static isNativeTokenId<C extends PlatformToChains<P>>(chain: C, tokenId: TokenId<C>): boolean {
  //   throw new Error("Method not implemented.");
  // }

  // static isSupportedChain(chain: Chain): boolean {
  //   throw new Error("Method not implemented.");
  // }

  // static getDecimals<C extends PlatformToChains<P>>(
  //   chain: C,
  //   rpc: RpcConnection<P>,
  //   token: TokenAddress<P>,
  // ): Promise<bigint> {
  //   throw new Error("Method not implemented.");
  // }
  // static getBalance<C extends PlatformToChains<P>>(
  //   chain: C,
  //   rpc: RpcConnection<P>,
  //   walletAddr: string,
  //   token: TokenAddress<P>,
  // ): Promise<bigint | null> {
  //   throw new Error("Method not implemented.");
  // }

  // static getBalances<C extends PlatformToChains<P>>(
  //   chain: C,
  //   rpc: RpcConnection<Platform>,
  //   walletAddress: string,
  //   tokens: TokenAddress<P>[],
  // ): Promise<Balances> {
  //   throw new Error("method not implemented");
  // }
  // static async getTokenBalance<C extends PlatformToChains<P>>(
  //   chain: C,
  //   rpc: RpcConnection<P>,
  //   walletAddr: string,
  //   token: TokenId<C>,
  // ): Promise<bigint | null> {
  //   return 10n;
  // }
  // static getProtocolInitializer<PN extends ProtocolName>(
  //   protocol: PN,
  // ): ProtocolInitializer<P, PN> {
  //   throw new Error("Method not implemented.");
  // }

  // static async sendWait(chain: Chain, rpc: RpcConnection<P>, stxns: any[]): Promise<TxHash[]> {
  //   throw new Error("Method not implemented.");
  // }

  getChain<C extends Chain>(chain: C): ChainContext<N, P, C> {
    if (chain in this.config) return new MockChain<N, P, C>(chain, this);
    throw new Error("No configuration available for chain: " + chain);
  }

  getRpc<C extends PlatformToChains<P>>(chain: C): RpcConnection<P> {
    return new MockRpc(chain);
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

  getDecimals<C extends PlatformToChains<P>>(
    chain: C,
    rpc: RpcConnection<P>,
    token: TokenAddress<C>,
  ): Promise<number> {
    throw new Error("Method not implemented.");
  }
}
