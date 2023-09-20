import { PlatformName } from "@wormhole-foundation/sdk-base";

export interface EvmRpc {
  broadcastTransaction(stxns: string): Promise<any>;
  getBalance(address: string): Promise<bigint>;
}
export interface SolanaRpc {
  getBalance(publicKey: any, commitmentOrConfig: any): Promise<number>;
  getParsedAccountInfo(publickKey: any): Promise<any>;
}

export interface CosmWasmRpc {
  getBalance(address: string, searchDenom: string): Promise<any>;
  broadcastTx(
    tx: Uint8Array,
    timeoutMs?: number,
    pollIntervalMs?: number
  ): Promise<any>;
}

export type RpcConnection<P extends PlatformName> = P extends "Evm"
  ? EvmRpc
  : P extends "Solana"
  ? SolanaRpc
  : P extends "Cosmwasm"
  ? CosmWasmRpc
  : never;
