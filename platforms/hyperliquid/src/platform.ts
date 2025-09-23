import type { ChainId, Network } from "@wormhole-foundation/sdk-connect";

import type { AnyHyperliquidAddress } from "./types.js";
import { _network, _platform } from "./types.js";

/**
 * @category Hyperliquid
 * Stub implementation of Hyperliquid platform
 */
export class HyperliquidPlatform<N extends Network> {
  readonly platform = _platform;
  readonly network = _network as N;

  constructor(network: N) {
    if (network !== _network) {
      throw new Error(`Invalid network: ${network}. Hyperliquid only supports mainnet`);
    }
  }

  static async getBalance(
    _network: Network,
    _chain: ChainId,
    _walletAddress: string,
    _token: any,
  ): Promise<bigint> {
    // Stub implementation - always return 0 for now
    // In a real implementation, this would query Hyperliquid's API
    return 0n;
  }

  getRpc(_chain: ChainId): any {
    throw new Error("Hyperliquid platform getRpc not implemented");
  }

  getChain(_chain: ChainId): HyperliquidChain {
    return new HyperliquidChain(this.network, _chain);
  }

  async healthy(_chain: ChainId): Promise<boolean> {
    // Stub - always return true for now
    return true;
  }
}

/**
 * @category Hyperliquid
 */
export class HyperliquidChain {
  readonly platform = _platform;

  constructor(
    readonly network: Network,
    readonly chain: ChainId,
  ) {}

  getRpc(): any {
    throw new Error("Hyperliquid chain getRpc not implemented");
  }

  async getBalance(): Promise<bigint> {
    // Stub implementation - always return 0
    return 0n;
  }

  async getTokenBalance(): Promise<bigint | null> {
    // Stub implementation
    return 0n;
  }

  async getBalances(tokens: any[]): Promise<Map<string, bigint | null>> {
    // Stub implementation - return empty balances
    const balances = new Map<string, bigint | null>();
    for (const token of tokens) {
      const key = typeof token === "string" ? token : token.toString();
      balances.set(key, 0n);
    }
    return balances;
  }

  async getNativeBalance(): Promise<bigint> {
    // Hyperliquid doesn't have a native token, return 0
    return 0n;
  }

  async getDecimals(): Promise<number> {
    // USDC has 6 decimals
    return 6;
  }

  parseAddress(_address: string): any {
    throw new Error("parseAddress not implemented for Hyperliquid");
  }

  async getLatestBlock(): Promise<number> {
    throw new Error("getLatestBlock not implemented for Hyperliquid");
  }

  async getLatestFinalizedBlock(): Promise<number> {
    throw new Error("getLatestFinalizedBlock not implemented for Hyperliquid");
  }

  async getWormholeCore(): Promise<any> {
    throw new Error("getWormholeCore not implemented for Hyperliquid");
  }
}
