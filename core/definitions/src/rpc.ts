// TODO: definition layer? more flexible?

import { PlatformName } from "@wormhole-foundation/sdk-base";

export interface EvmRpc {
  broadcastTransaction(stxns: string): Promise<any>;
  getBalance(address: string): Promise<bigint>;
}
export interface SolRpc {
  getBalance(publicKey: any, commitmentOrConfig: any): Promise<number>;
  getParsedAccountInfo(publickKey: any): Promise<any>;
}

export type RpcConnection<P extends PlatformName> = P extends "Evm"
  ? EvmRpc
  : P extends "Solana"
  ? SolRpc
  : never;
