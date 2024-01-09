import { PlatformToChains, Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import {
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcBridge,
  IbcMessageId,
  IbcTransferInfo,
  TokenBridge,
  TransactionId,
  TxHash,
  isGatewayTransferMsg,
  isGatewayTransferWithPayloadMsg,
  isIbcMessageId,
  isTransactionIdentifier,
} from "@wormhole-foundation/sdk-definitions";
import { DEFAULT_TASK_TIMEOUT } from "./config";

// A task is a retryable function, it should return a Thing or null for a failure case
// It should throw on a permanent failure instead of retrying
// In cases where the failure is temporary it should return null
// (e.g. transaction not complete yet, vaa not available yet, ...)

export type Task<T> = () => Promise<T | null>;

export async function retry<T>(
  task: Task<T>,
  interval: number,
  timeout: number = DEFAULT_TASK_TIMEOUT,
  title?: string,
): Promise<T | null> {
  const maxRetries = Math.floor(timeout / interval);

  let retries = 0;
  return new Promise<T | null>((resolve, reject) => {
    task().then((result) => {
      if (result !== null) {
        resolve(result);
        return;
      }

      let intervalId = setInterval(async () => {
        if (retries >= maxRetries) {
          clearInterval(intervalId);
          resolve(null);
          return;
        }

        const result = await task();
        if (result !== null) {
          clearInterval(intervalId);
          resolve(result);
        } else if (title) {
          console.log(`Retrying ${title}, attempt ${retries}/${maxRetries} `);
        }

        retries++;
      }, interval);
    });
  });
}

export async function isTokenBridgeVaaRedeemed<
  N extends Network,
  P extends Platform,
  C extends Chain,
>(tb: TokenBridge<N, P, C>, vaa: TokenBridge.TransferVAA): Promise<boolean | null> {
  try {
    const isRedeemed = await tb.isTransferCompleted(vaa);
    // Only return a real value if its true, otherwise return null
    // signaling that we should retry
    return isRedeemed ? isRedeemed : null;
  } catch (e) {
    console.error(`Caught an error checking if VAA is redeemed: ${e}\n`);
    return null;
  }
}

export async function fetchIbcXfer<N extends Network, C extends PlatformToChains<"Cosmwasm">>(
  wcIbc: IbcBridge<N, "Cosmwasm", C>,
  msg: TxHash | TransactionId | IbcMessageId | GatewayTransferMsg | GatewayTransferWithPayloadMsg,
): Promise<IbcTransferInfo | null> {
  try {
    if (isIbcMessageId(msg)) return await wcIbc.lookupTransferFromIbcMsgId(msg);
    else if (isTransactionIdentifier(msg)) return await wcIbc.lookupTransferFromTx(msg.txid);
    else if (isGatewayTransferMsg(msg) || isGatewayTransferWithPayloadMsg(msg))
      return await wcIbc.lookupTransferFromMsg(msg);
    else throw new Error("Invalid message type:" + JSON.stringify(msg));
  } catch (e) {
    console.error("Caught an error looking for ibc transfer: ", e);
  }
  return null;
}
