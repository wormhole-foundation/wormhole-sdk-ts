import { stripPrefix, toChainId } from "@wormhole-foundation/sdk-base";
import { WormholeMessageId } from "@wormhole-foundation/sdk-definitions";
import axios from "axios";

/**
 * Gets the bytes of a VAA for a given WormholeMessageId or `null` if the VAA is not available yet.
 * @param rpcUrl the url of the wormholescan API
 * @param whm the WormholeMessageId
 * @returns a Uint8Array containing the VAA or `null` if it's not available yet
 * @throws Errors if the service throws an unrecoverable error (e.g. 500)
 */
export async function getVaaBytes(
  rpcUrl: string,
  whm: WormholeMessageId,
): Promise<Uint8Array | null> {
  const { chain, emitter, sequence } = whm;
  const chainId = toChainId(chain);
  const emitterAddress = stripPrefix(
    "0x",
    emitter.toUniversalAddress().toString(),
  );

  const url = `${rpcUrl}/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;
  console.log(url)

  try {
    const {
      data: { vaaBytes },
    } = await axios.get<{ vaaBytes: string }>(url, {
      timeout: 2000,
    });
    return new Uint8Array(Buffer.from(vaaBytes, "base64"));
  } catch (error) {
    // This is a 404 error, which means the VAA is not yet available
    // since its not available yet, we return null signaling it can be tried again

    // TODO: this is buggy
    if (!(axios.isAxiosError(error) && error?.response?.status === 404)) {
      return null;
    }
    return null
    //throw error;
  }
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
