import { ChainName, Network, PlatformName } from "@wormhole-foundation/sdk-base";
import { ChainsConfig, TokenId, TokenTransferTransaction, TxHash } from "./types";
import { UniversalAddress } from "../universalAddress";
import { ChainContext } from "./chain";
import { TokenBridge } from "../protocolInterfaces/tokenBridge";

export abstract class Platform {
  public static platform: PlatformName;
  abstract network: Network;
  abstract conf: ChainsConfig;
  abstract setConnection(chain: ChainName, rpc: string): void;
  abstract getConnection(chain?: ChainName): any;
  // TODO: Asset vs token?
  abstract getForeignAsset(
    chain: ChainName,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null>;
  abstract getTokenDecimals(
    chain: ChainName,
    tokenAddr: UniversalAddress,
  ): Promise<bigint>;
  abstract getNativeBalance(chain: ChainName, walletAddr: string): Promise<bigint>;
  abstract getTokenBalance(
    chain: ChainName,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null>;
  abstract getTokenBridge(chain: ChainName): Promise<TokenBridge<PlatformName>>;
  abstract getChain(chain: ChainName): ChainContext;
  abstract parseAddress(address: string): UniversalAddress;
  abstract parseTransaction(
    chain: ChainName,
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]>;
}

export type PlatformCtr = {
  _platform: PlatformName;
  new (network: Network, conf: ChainsConfig): Platform;
};
