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
  PlatformCtr,
  toNative,
  nativeIsRegistered,
} from "../..";
import { MockRpc } from "./rpc";
import { MockChain } from "./chain";
import { MockTokenBridge } from "./tokenBridge";
import { WormholeCore } from "../../protocols/core";

export function mockPlatformFactory(
  p: PlatformName
): PlatformCtr<PlatformName> {
  class ConcreteMockPlatform extends MockPlatform<typeof p> {
    static _platform: typeof p = p;
    readonly platform = ConcreteMockPlatform._platform;
  }
  return ConcreteMockPlatform;
}

// Note: don't use this directly, instead create a ConcreteMockPlatform with the
// mockPlatformFactory
export class MockPlatform<P extends PlatformName> implements Platform<P> {
  // @ts-ignore
  readonly platform: P;

  conf: ChainsConfig;

  constructor(conf: ChainsConfig) {
    this.conf = conf;
  }
  getDecimals(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId | "native"
  ): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  getBalance(
    chain:
      | "Solana"
      | "Btc"
      | "Algorand"
      | "Sui"
      | "Aptos"
      | "Osmosis"
      | "Wormchain"
      | "Near"
      | "Ethereum"
      | "Terra"
      | "Bsc"
      | "Polygon"
      | "Avalanche"
      | "Oasis"
      | "Aurora"
      | "Fantom"
      | "Karura"
      | "Acala"
      | "Klaytn"
      | "Celo"
      | "Moonbeam"
      | "Neon"
      | "Terra2"
      | "Injective"
      | "Arbitrum"
      | "Optimism"
      | "Gnosis"
      | "Pythnet"
      | "Xpla"
      | "Base"
      | "Sei"
      | "Sepolia",
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId | "native"
  ): Promise<bigint | null> {
    throw new Error("Method not implemented.");
  }

  getChain(chain: ChainName): ChainContext<P> {
    return new MockChain<P>(this, chain);
  }
  getRpc(chain: ChainName): RpcConnection<P> {
    // @ts-ignore
    return new MockRpc(chain);
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

  parseAddress(chain: ChainName, address: string): UniversalAddress {
    if (!nativeIsRegistered(chain)) throw new Error("Chain not registered");
    //@ts-ignore
    return toNative(chain, address).toUniversalAddress();
  }

  async sendWait(rpc: RpcConnection<P>, stxns: any[]): Promise<TxHash[]> {
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
