import { encoding, toChainId } from "@wormhole-foundation/sdk-base";
import {
  PayloadDiscriminator,
  PayloadLiteral,
  TxHash,
  WormholeMessageId,
  deserialize,
} from "@wormhole-foundation/sdk-definitions";
import axios from "axios";
import { retry } from "./tasks";

export const WHSCAN_RETRY_INTERVAL = 2000;

// TransactionStatus returned by wormholescan
export interface TransactionStatus {
  id: string;
  timestamp: string;
  txHash: string;
  emitterChain: number;
  emitterAddress: string;
  emitterNativeAddress: string;
  payload: {
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
  };
  standardizedProperties: {
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
  };
  globalTx?: {
    id: string;
    originTx: {
      txHash: string;
      from: string;
      status: string;
    };
    destinationTx?: {
      chainId: number;
      status: string;
      method: string;
      txHash: string;
      from: string;
      to: string;
      blockNumber: string;
      timestamp: string;
      updatedAt: string;
    };
  };
}

export interface RelayData {
  from: {
    chain: string;
    chainId: number;
    txHash: string;
    senderAddress: string;
    symbol: string;
    amountSent: number;
    amountToSwap: number;
    estimatedNativeAssetAmount: number;
  };
  vaa: string;
  status: string;
  fee: {
    amount: number;
    symbol: string;
  };
  error: any;
  to: {
    chain: string;
    chainId: number;
    recipientAddress: string;
    txHash: string;
    gasUsed: number;
    nativeAssetSymbol: string;
    nativeAssetReceived: number;
  };
  metrics: {
    receivedAt: string;
    completedAt: string;
    failedAt: any;
    attempts: number;
    maxAttempts: number;
    waitingForTxInMs: number;
    waitingForWalletInMs: number;
  };
}

export interface ApiVaa {
  sequence: number;
  id: string;
  version: number;
  emitterChain: number;
  emitterAddr: string;
  emitterNativeAddr: string;
  guardianSetIndex: number;
  vaa: string;
  timestamp: string;
  updatedAt: string;
  indexedAt: string;
  txHash: string;
}

/**
 * Gets the bytes of a VAA for a given WormholeMessageId or `null` if the VAA is not available yet.
 * @param apiUrl the url of the wormholescan API
 * @param whm the WormholeMessageId
 * @returns a Uint8Array containing the VAA or `null` if it's not available yet
 * @throws Errors if the service throws an unrecoverable error (e.g. 500)
 */
export async function getVaaBytes(
  apiUrl: string,
  whm: WormholeMessageId,
): Promise<Uint8Array | null> {
  const { chain, emitter, sequence } = whm;
  const chainId = toChainId(chain);
  const emitterAddress = encoding.stripPrefix("0x", emitter.toString());
  const url = `${apiUrl}/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;
  try {
    const {
      data: { vaaBytes },
    } = await axios.get<{ vaaBytes: string }>(url);
    return encoding.b64.decode(vaaBytes);
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }
    throw error;
  }
}

export async function getVaaBytesWithRetry(
  apiUrl: string,
  whm: WormholeMessageId,
  timeout: number,
): Promise<Uint8Array | null> {
  const task = () => getVaaBytes(apiUrl, whm);
  return await retry<Uint8Array>(task, WHSCAN_RETRY_INTERVAL, timeout, "Wormholescan:GetVaaBytes");
}

export async function getVaa<T extends PayloadLiteral | PayloadDiscriminator>(
  apiUrl: string,
  whm: WormholeMessageId,
  decodeAs: T,
): Promise<ReturnType<typeof deserialize<T>> | null> {
  const vaaBytes = await getVaaBytes(apiUrl, whm);
  if (!vaaBytes) return null;
  return deserialize(decodeAs, vaaBytes);
}

export async function getVaaWithRetry<T extends PayloadLiteral | PayloadDiscriminator>(
  apiUrl: string,
  whm: WormholeMessageId,
  decodeAs: T,
  timeout: number,
): Promise<ReturnType<typeof deserialize<T>> | null> {
  const task = () => getVaa(apiUrl, whm, decodeAs);
  return await retry<ReturnType<typeof deserialize<T>>>(
    task,
    WHSCAN_RETRY_INTERVAL,
    timeout,
    "Wormholescan:GetVaaBytes",
  );
}

/**
 * Gets the status for a transaction given WormholeMessageId or `null` if the VAA is not available yet.
 * @param rpcUrl the url of the wormholescan API
 * @param whm the WormholeMessageId
 * @returns a TransactionStatus or `null` if it's not available yet
 * @throws Errors if the service throws an unrecoverable error (e.g. 500)
 */
export async function getTransactionStatus(
  rpcUrl: string,
  whm: WormholeMessageId,
): Promise<TransactionStatus | null> {
  const { chain, emitter, sequence } = whm;
  const chainId = toChainId(chain);
  const emitterAddress = emitter.toUniversalAddress().toString();
  const url = `${rpcUrl}/api/v1/transactions/${chainId}/${emitterAddress}/${sequence}`;

  try {
    const response = await axios.get<TransactionStatus>(url);
    return response.data;
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }
    throw error;
  }
}

export async function getTransactionStatusWithRetry(
  rpcUrl: string,
  whm: WormholeMessageId,
  timeout: number,
): Promise<TransactionStatus | null> {
  const task = () => getTransactionStatus(rpcUrl, whm);
  return await retry<TransactionStatus>(
    task,
    WHSCAN_RETRY_INTERVAL,
    timeout,
    "Wormholescan:GetTransactionStatus",
  );
}

export async function getRelayStatus(rpcUrl: string, txid: TxHash): Promise<RelayData | null> {
  const url = `${rpcUrl}/v1/relays?txHash=${txid}`;
  try {
    const response = await axios.get<{ data: RelayData }>(url);
    if (response.data.data.to.txHash) return response.data.data;
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }
    throw error;
  }
  return null;
}

export async function getRelayStatusWithRetry(
  rpcUrl: string,
  txid: TxHash,
  timeout: number,
): Promise<RelayData | null> {
  const task = () => getRelayStatus(rpcUrl, txid);
  return retry<RelayData>(task, WHSCAN_RETRY_INTERVAL, timeout, "Wormholescan:GetRelayStatus");
}

export async function getVaaByTxHash(rpcUrl: string, txid: string): Promise<ApiVaa | null> {
  const url = `${rpcUrl}/api/v1/vaas?txHash=${txid}`;
  try {
    const response = await axios.get<{ data: ApiVaa[] }>(url);
    if (response.data.data.length > 0) return response.data.data[0]!;
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }
    throw error;
  }
  return null;
}

export async function getVaaByTxHashWithRetry<T extends PayloadLiteral | PayloadDiscriminator>(
  rpcUrl: string,
  txid: TxHash,
  decodeAs: T,
  timeout: number,
): Promise<ReturnType<typeof deserialize<T>> | null> {
  const task = () => getVaaByTxHash(rpcUrl, txid);
  const vaa = await retry<ApiVaa>(
    task,
    WHSCAN_RETRY_INTERVAL,
    timeout,
    "Wormholescan:GetVaaByTxHash",
  );

  if (!vaa) return null;

  return deserialize(decodeAs, encoding.b64.decode(vaa.vaa));
}

export async function getTxsByAddress(
  rpcUrl: string,
  address: string,
  pageSize: number = 50,
  page: number = 0,
): Promise<TransactionStatus[] | null> {
  const url = `${rpcUrl}/api/v1/transactions?address=${address}&pageSize=${pageSize}&page=${page}`;
  try {
    const response = await axios.get<{ transactions: TransactionStatus[] }>(url);
    if (response.data.transactions.length > 0) return response.data.transactions;
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }
    throw error;
  }
  return null;
}
