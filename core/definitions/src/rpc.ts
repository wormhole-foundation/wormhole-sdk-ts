// TODO: definition layer? more flexible?
export interface RpcConnection {
  broadcastTransaction(stxns: string): Promise<any>;
  getBalance(address: string): Promise<bigint>;
}
