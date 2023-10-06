import { PlatformName } from '@wormhole-foundation/sdk-base';
import {
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcTransferInfo,
  IbcBridge,
  IbcMessageId,
  TokenBridge,
  TransactionId,
  TxHash,
  VAA,
  isGatewayTransferMsg,
  isGatewayTransferWithPayloadMsg,
  isIbcMessageId,
  isTransactionIdentifier,
} from '@wormhole-foundation/sdk-definitions';

export async function isVaaRedeemed(
  tb: TokenBridge<PlatformName>,
  vaas: (VAA<'Transfer'> | VAA<'TransferWithPayload'>)[],
) {
  const redeemed = await Promise.all(
    vaas.map((v) => {
      return tb.isTransferCompleted(v);
    }),
  );
  return redeemed.every((v) => v);
}

export async function fetchIbcXfer(
  wcIbc: IbcBridge<'Cosmwasm'>,
  msg:
    | TxHash
    | TransactionId
    | IbcMessageId
    | GatewayTransferMsg
    | GatewayTransferWithPayloadMsg,
): Promise<IbcTransferInfo | null> {
  // TODO: check for errors
  if (isTransactionIdentifier(msg)) {
    try {
      return await wcIbc.lookupTransferFromTx(msg.txid);
    } catch (e) {}
    //
  } else if (
    isGatewayTransferMsg(msg) ||
    isGatewayTransferWithPayloadMsg(msg)
  ) {
    try {
      return await wcIbc.lookupTransferFromMsg(msg);
    } catch (e) {}
  } else if (isIbcMessageId(msg)) {
    // Try both directions
    // TODO: can we do this in one query?
    try {
      return await wcIbc.lookupTransferFromSequence(
        msg.dstChannel,
        true,
        msg.sequence,
      );
    } catch (e) {}
    try {
      return await wcIbc.lookupTransferFromSequence(
        msg.dstChannel,
        false,
        msg.sequence,
      );
    } catch (e) {}
  }

  return null;
}
