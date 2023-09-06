export interface TransactionStatus {
  id: string;
  timestamp: string;
  txHash: string;
  emitterChain: number;
  emitterAddress: string;
  emitterNativeAddress: string;
  payload: Payload;
  standardizedProperties: StandardizedProperties;
  globalTx: GlobalTx;
}

export interface Payload {
  amount: string;
  callerAppId: string;
  fee: string;
  fromAddress: string;
  parsedPayload: any;
  payload: string;
  payloadType: number;
  toAddress: string;
  toChain: number;
  tokenAddress: string;
  tokenChain: number;
}

export interface StandardizedProperties {
  amount: string;
  appIds: string[];
  fee: string;
  feeAddress: string;
  feeChain: number;
  fromAddress: string;
  fromChain: number;
  toAddress: string;
  toChain: number;
  tokenAddress: string;
  tokenChain: number;
}

export interface GlobalTx {
  id: string;
  originTx: OriginTx;
  destinationTx?: DestinationTx;
}

export interface OriginTx {
  txHash: string;
  from: string;
  status: string;
}

export interface DestinationTx {
  chainId: number;
  status: string;
  method: string;
  txHash: string;
  from: string;
  to: string;
  blockNumber: string;
  timestamp: string;
  updatedAt: string;
}
