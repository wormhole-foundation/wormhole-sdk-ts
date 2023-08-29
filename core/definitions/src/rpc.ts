// TODO: definition layer? more flexible?

export interface EvmRpc {
  broadcastTransaction(stxns: string): Promise<any>;
  getBalance(address: string): Promise<bigint>;
}
export interface SolRpc {
  getBalance(publicKey: any, commitmentOrConfig: any): Promise<number>;
  getParsedAccountInfo(publickKey: any): Promise<any>;
}

export type RpcConnection = EvmRpc | SolRpc;
