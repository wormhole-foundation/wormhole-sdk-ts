import {
  ChainName,
  PlatformName,
  stripPrefix,
  toChainId,
} from "@wormhole-foundation/sdk-base";
import {
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcBridge,
  IbcMessageId,
  IbcTransferInfo,
  NativeAddress,
  TokenBridge,
  TransactionId,
  TxHash,
  UniversalAddress,
  VAA,
  WormholeMessageId,
  isGatewayTransferMsg,
  isGatewayTransferWithPayloadMsg,
  isIbcMessageId,
  isTransactionIdentifier,
} from "@wormhole-foundation/sdk-definitions";
import axios, { AxiosRequestConfig } from "axios";
import { TransactionStatus } from "../api";

// A task is a retryable function, it should return a Thing or null for a failure case
// It should throw on a permanent failure instead of retrying
// In cases where the failure is temporary it should return null
// (e.g. transaction not complete yet, vaa not available yet, ...)

// TODO: determine if an error is unrecoverable
// (e.g. http 500, 429 ...)

export type Task<T> = () => Promise<T | null>;

export type VaaResponse = {
  vaaBytes: string;
};
export async function getVaaBytes(
  rpcUrl: string,
  whm: WormholeMessageId,
): Promise<Uint8Array | null> {
  const { chain, emitter, sequence } = whm;
  const chainId = toChainId(chain);
  const emitterAddress = stripPrefix(
    emitter.toUniversalAddress().toString(),
    "0x",
  );

  const url = `${rpcUrl}/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;

  try {
    const {
      data: { vaaBytes },
    } = await axios.get<VaaResponse>(url, {
      timeout: 2000,
    });
    return new Uint8Array(Buffer.from(vaaBytes, "base64"));
  } catch (e) {
    // TODO: check if unrecoverable
    console.error(`Caught an error waiting for VAA: ${e}\n${url}\n`);
  }
  return null;
}

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
  } catch (e) {
    // TODO: check if unrecoverable
    console.error("Caught an error waiting for transaction status: ", e);
  }
  return null;
}

export async function isTokenBridgeVaaRedeemed(
  tb: TokenBridge<PlatformName>,
  vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
): Promise<boolean | null> {
  try {
    const isRedeemed = await tb.isTransferCompleted(vaa);
    return isRedeemed ?? null;
  } catch (e) {
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
    console.error("Failed to lookup transfer from tx: ", e);
  }
  return null;
}
