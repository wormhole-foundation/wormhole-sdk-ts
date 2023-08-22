import { ChainName, Network, PlatformName } from "@wormhole-foundation/sdk-base";
import { ChainsConfig, RpcConnection, TokenId, TokenTransferTransaction, TxHash } from "./types";
import { UniversalAddress } from "../universalAddress";
import { ChainContext } from "./chain";
import { TokenBridge } from "../protocolInterfaces/tokenBridge/tokenBridge";

export abstract class Platform {
  public static platform: PlatformName;
  abstract network: Network;
  abstract conf: ChainsConfig;
  // TODO: Asset vs token?
  abstract getForeignAsset(
    rpc: RpcConnection,
    chain: ChainName,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null>;
  abstract getTokenDecimals(
    rpc: RpcConnection,
    tokenAddr: UniversalAddress,
  ): Promise<bigint>;
  abstract getNativeBalance(rpc: RpcConnection, walletAddr: string, chain: ChainName): Promise<bigint>;
  abstract getTokenBalance(
    rpc: RpcConnection,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null>;
  abstract getRpc(chain: ChainName): RpcConnection;
  abstract getTokenBridge(rpc: RpcConnection): Promise<TokenBridge<PlatformName>>;
  abstract getChain(chain: ChainName): ChainContext;
  abstract parseAddress(address: string): UniversalAddress;
  abstract parseTransaction(
    rpc: RpcConnection,
    chain: ChainName,
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]>;
}

export type PlatformCtr = {
  _platform: PlatformName;
  new (network: Network, conf: ChainsConfig): Platform;
};
