import {
  type ChainContext,
  type ChainsConfig,
  chainToPlatform,
  type ChainToPlatform,
  type Network,
  networkPlatformConfigs,
  PlatformContext,
  type RpcConnection,
  type StaticPlatformMethods,
  type TokenId,
  type TxHash,
  type SignedTx,
  isNative,
  decimals,
  amount,
  type TokenAddress,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";
import type { Chain } from "@wormhole-foundation/sdk-connect";
import { _platform, type XrplChains, type XrplPlatformType } from "./types.js";
import { XrplChain } from "./chain.js";
import { XrplAddress, XrplZeroAddress } from "./address.js";
import { Client } from "xrpl";

function safeBigInt(value: unknown, fallback: bigint | null = null): bigint | null {
  try {
    return BigInt(value as string);
  } catch {
    return fallback;
  }
}

async function ensureConnected(rpc: Client): Promise<void> {
  if (!rpc.isConnected()) {
    await rpc.connect();
  }
}

export class XrplPlatform<N extends Network>
  extends PlatformContext<N, XrplPlatformType>
  implements StaticPlatformMethods<XrplPlatformType, typeof XrplPlatform>
{
  static _platform = _platform;

  constructor(network: N, config?: ChainsConfig<N, XrplPlatformType>) {
    super(network, config ?? networkPlatformConfigs(network, XrplPlatform._platform));
  }

  override getRpc<C extends XrplChains>(chain: C): Client {
    const chainConfig = this.config[chain]!;
    return new Client(chainConfig.rpc, chainConfig.httpHeaders ? { headers: chainConfig.httpHeaders } : undefined);
  }

  override getChain<C extends XrplChains>(
    chain: C,
    rpc?: RpcConnection<C>,
  ): ChainContext<N, C, ChainToPlatform<C>> {
    if (chain in this.config) {
      return new XrplChain<N, C>(chain, this, rpc);
    }
    throw new Error("No configuration available for chain: " + chain);
  }

  static isSupportedChain(chain: Chain): boolean {
    const platform = chainToPlatform(chain);
    return platform === XrplPlatform._platform;
  }

  static nativeTokenId<N extends Network, C extends XrplChains>(network: N, chain: C): TokenId<C> {
    if (!XrplPlatform.isSupportedChain(chain)) {
      throw new Error(`invalid chain for Xrpl: ${chain}`);
    }
    return Wormhole.tokenId(chain, XrplZeroAddress);
  }

  static isNativeTokenId<N extends Network, C extends XrplChains>(
    network: N,
    chain: C,
    tokenId: TokenId<C>,
  ): boolean {
    if (!XrplPlatform.isSupportedChain(chain)) {
      return false;
    }
    if (tokenId.chain !== chain) {
      return false;
    }
    return tokenId.address.toString() === XrplZeroAddress;
  }

  static async getDecimals<C extends XrplChains>(
    _network: Network,
    _chain: C,
    _rpc: RpcConnection<C>,
    token: TokenAddress<C>,
  ): Promise<number> {
    if (isNative(token)) {
      return decimals.nativeDecimals(XrplPlatform._platform);
    }

    const addr = new XrplAddress(token.toString());

    if (addr.format === "iou" || addr.format === "mpt") {
      // TODO: IOU tokens have no on-chain decimals metadata; MPT tokens store
      // decimals in the AssetScale field of the MPTokenIssuance ledger entry.
      // For now we assume 9 decimals for both.
      return 9;
    }

    throw new Error(`Unsupported XRPL token format: ${token}`);
  }

  static async getBalance<C extends XrplChains>(
    _network: Network,
    _chain: C,
    rpc: Client,
    walletAddr: string,
    token: TokenAddress<C>,
  ): Promise<bigint | null> {
    if (isNative(token)) {
      await ensureConnected(rpc);
      const response = await rpc.request({
        command: "account_info",
        account: walletAddr,
        ledger_index: "validated",
      });
      return safeBigInt(response.result.account_data.Balance);
    }

    const addr = new XrplAddress(token.toString());

    if (addr.format === "iou") {
      return XrplPlatform.getIouBalance(rpc, walletAddr, addr.address);
    }

    if (addr.format === "mpt") {
      return XrplPlatform.getMptBalance(rpc, walletAddr, addr.address);
    }

    throw new Error(`Unsupported XRPL token format: ${token}`);
  }

  // Query account_lines for IOU trust line balance.
  // TODO: account_lines is paginated (up to 400 per page). The peer filter scopes to
  // one issuer so 400 currencies is sufficient for now; add marker-based pagination if needed.
  // https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_lines
  private static async getIouBalance(
    rpc: Client,
    walletAddr: string,
    tokenId: string,
  ): Promise<bigint | null> {
    const { code, issuer } = XrplAddress.parseIou(tokenId);
    await ensureConnected(rpc);
    const response = await rpc.request({
      command: "account_lines",
      account: walletAddr,
      peer: issuer,
      ledger_index: "validated",
    });

    const line = response.result.lines.find((l: { currency: string }) => l.currency === code);
    if (!line) {
      return null;
    }

    // Trust line balance is a decimal string (e.g. "100.5").
    // TODO: hardcoded 9 decimals — should match getDecimals() once
    // per-token decimal resolution is implemented.
    if (line.balance.startsWith("-")) {
      return 0n;
    }
    try {
      return amount.units(amount.parse(line.balance, 9));
    } catch {
      return null;
    }
  }

  // Query account_objects for MPToken balance.
  // TODO: account_objects is paginated (up to 400 per page); add marker-based pagination if needed.
  // https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/mptoken
  private static async getMptBalance(
    rpc: Client,
    walletAddr: string,
    mptIssuanceId: string,
  ): Promise<bigint | null> {
    await ensureConnected(rpc);
    const response = await rpc.request({
      command: "account_objects",
      account: walletAddr,
      type: "mptoken",
      ledger_index: "validated",
    });

    const objects = response.result.account_objects as unknown as Record<string, unknown>[];
    const mpt = objects.find(
      (obj) =>
        obj.LedgerEntryType === "MPToken" &&
        (obj.MPTokenIssuanceID as string)?.toUpperCase() === mptIssuanceId.toUpperCase(),
    );
    if (!mpt) {
      return null;
    }

    const mptAmount = mpt.MPTAmount;
    if (mptAmount == null) {
      return 0n;
    }
    // MPTAmount in a ledger entry is an integer string (already in base units)
    return safeBigInt(mptAmount, 0n);
  }

  static async getLatestBlock<C extends XrplChains>(rpc: RpcConnection<C>): Promise<number> {
    throw new Error("Method not implemented.");
  }

  static async getLatestFinalizedBlock<C extends XrplChains>(
    rpc: RpcConnection<C>,
  ): Promise<number> {
    throw new Error("Method not implemented.");
  }

  static async sendWait<C extends XrplChains>(
    chain: C,
    rpc: RpcConnection<C>,
    stxns: SignedTx[],
  ): Promise<TxHash[]> {
    throw new Error("Method not implemented.");
  }

  static chainFromChainId(chainId: string): [Network, XrplChains] {
    throw new Error("Method not implemented.");
  }

  static async chainFromRpc(rpc: Client): Promise<[Network, XrplChains]> {
    await ensureConnected(rpc);
    const response = await rpc.request({
      command: "server_info",
    });
    const networkId = response.result.info.network_id;
    if (networkId === 0 || networkId === undefined) {
      return ["Mainnet", "Xrpl"];
    }
    return ["Testnet", "Xrpl"];
  }
}
