import {
  PlatformName,
  Network,
  ChainName,
} from "@wormhole-foundation/sdk-base";
import { UniversalAddress } from "./universalAddress";
import { ChainContext } from "./chain";
import { RpcConnection } from "./rpc";
import { TokenId, TxHash } from "./types";
import { WormholeMessageId } from "./attestation";
import { SignedTxn } from "./types";
// protocols
import { TokenBridge, AutomaticTokenBridge } from "./protocols/tokenBridge";
import { CircleBridge, AutomaticCircleBridge } from "./protocols/cctp";

// TODO: move to definition layer? -- Can't without more changes, TokenTransferTransaction declared here
// Force passing RPC connection so we don't create a new one with every fn call
export interface Platform {
  readonly platform: PlatformName;
  readonly network?: Network;
  // Utils for platform specific queries
  getForeignAsset(
    chain: ChainName,
    rpc: RpcConnection,
    tokenId: TokenId
  ): Promise<UniversalAddress | null>;
  getTokenDecimals(
    rpc: RpcConnection,
    tokenAddr: UniversalAddress
  ): Promise<bigint>;
  getNativeBalance(rpc: RpcConnection, walletAddr: string): Promise<bigint>;
  getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection,
    walletAddr: string,
    tokenId: TokenId
  ): Promise<bigint | null>;

  //
  getChain(chain: ChainName): ChainContext;
  getRpc(chain: ChainName): RpcConnection;

  // protocol clients
  getTokenBridge(rpc: RpcConnection): Promise<TokenBridge<PlatformName>>;
  getAutomaticTokenBridge(
    rpc: RpcConnection
  ): Promise<AutomaticTokenBridge<PlatformName>>;
  getAutomaticCircleBridge(
    rpc: RpcConnection
  ): Promise<AutomaticCircleBridge<PlatformName>>;
  getCircleBridge(rpc: RpcConnection): Promise<CircleBridge<PlatformName>>;

  // Platform interaction utils
  sendWait(rpc: RpcConnection, stxns: SignedTxn[]): Promise<TxHash[]>;
  parseTransaction(
    chain: ChainName,
    rpc: RpcConnection,
    txid: TxHash
  ): Promise<WormholeMessageId[]>;
  parseAddress(address: string): UniversalAddress;
}
