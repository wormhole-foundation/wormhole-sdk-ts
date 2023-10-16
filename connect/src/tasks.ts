import { PlatformName } from "@wormhole-foundation/sdk-base";
import {
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcBridge,
  IbcMessageId,
  IbcTransferInfo,
  TokenBridge,
  TransactionId,
  TxHash,
  VAA,
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

// TODO: determine if an error is unrecoverable
// (e.g. http 500, 429 ...)

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
    const intervalId = setInterval(async () => {
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
}

export async function isTokenBridgeVaaRedeemed(
  tb: TokenBridge<PlatformName>,
  vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
): Promise<boolean | null> {
  try {
    const isRedeemed = await tb.isTransferCompleted(vaa);
    return isRedeemed ?? null;
  } catch (e) {
    // TODO: what types of errors might we catch here? 429? 500?
    console.error(`Caught an error checking if VAA is redeemed: ${e}\n`);
    return null;
  }
}

export async function fetchIbcXfer(
  wcIbc: IbcBridge<"Cosmwasm">,
  msg:
    | TxHash
    | TransactionId
    | IbcMessageId
    | GatewayTransferMsg
    | GatewayTransferWithPayloadMsg,
): Promise<IbcTransferInfo | null> {
  try {
    if (isIbcMessageId(msg)) return await wcIbc.lookupTransferFromIbcMsgId(msg);
    else if (isTransactionIdentifier(msg))
      return await wcIbc.lookupTransferFromTx(msg.txid);
    else if (isGatewayTransferMsg(msg) || isGatewayTransferWithPayloadMsg(msg))
      return await wcIbc.lookupTransferFromMsg(msg);
    else throw new Error("Invalid message type:" + JSON.stringify(msg));
  } catch (e) {
    // TODO: what type of errors might we catch here? 429? 500?
    console.error("Failed to lookup transfer from tx: ", e);
  }
  return null;
}
