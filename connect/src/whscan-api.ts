import {
  ChainName,
  PlatformName,
  encoding,
  toChainId,
} from "@wormhole-foundation/sdk-base";
import {
  NativeAddress,
  PayloadDiscriminator,
  PayloadLiteral,
  UniversalAddress,
  VAA,
  WormholeMessageId,
  deserialize,
} from "@wormhole-foundation/sdk-definitions";
import axios from "axios";
import { DEFAULT_TASK_TIMEOUT, WHSCAN_RETRY_INTERVAL } from "./config";
import { retry } from "./tasks";

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
  const emitterAddress = encoding.stripPrefix(
    "0x",
    emitter.toUniversalAddress().toString(),
  );

  const url = `${apiUrl}/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;

  try {
    const {
      data: { vaaBytes },
    } = await axios.get<{ vaaBytes: string }>(url, {
      timeout: 2000,
    });
    return encoding.b64.decode(vaaBytes);
  } catch (error) {
    if (!error) return null;

    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404)
        return null;
      if ("status" in error && error.status === 404) return null;
    }

    throw error;
  }
}

export async function getVaaBytesWithRetry(
  apiUrl: string,
  whm: WormholeMessageId,
  timeout: number = DEFAULT_TASK_TIMEOUT,
): Promise<Uint8Array | undefined> {
  const task = () => getVaaBytes(apiUrl, whm);
  const vaaBytes = await retry<Uint8Array>(
    task,
    WHSCAN_RETRY_INTERVAL,
    timeout,
    "Wormholescan:GetVaaBytes",
  );
  return vaaBytes ?? undefined;
}

export async function getVaaWithRetry<
  T extends PayloadLiteral | PayloadDiscriminator,
>(
  apiUrl: string,
  whm: WormholeMessageId,
  decodeAs: T,
  timeout: number = DEFAULT_TASK_TIMEOUT,
): Promise<ReturnType<typeof deserialize<T>> | undefined> {
  const vaaBytes = await getVaaBytesWithRetry(apiUrl, whm, timeout);
  if (vaaBytes === undefined) return;
  return deserialize(decodeAs, vaaBytes);
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
    // This is a 404 error, which means the VAA is not yet available
    // since its not available yet, we return null signaling it can be tried again
    if (!(axios.isAxiosError(error) && error?.response?.status === 404)) {
      return null;
    }
    throw error;
  }
}

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
  globalTx: {
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
