import { ChainId, createNonce } from '@wormhole-foundation/connect-sdk';
import { SuiCoinObject } from './types';
import {
  JsonRpcProvider,
  SUI_CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
  TransactionBlock,
} from '@mysten/sui.js';
import { getPackageId, isSameType } from './utils';

export async function transferFromSui(
  provider: JsonRpcProvider,
  coreBridgeStateObjectId: string,
  tokenBridgeStateObjectId: string,
  coins: SuiCoinObject[],
  coinType: string,
  amount: bigint,
  recipientChainId: ChainId,
  recipient: Uint8Array,
  feeAmount: bigint = BigInt(0),
  relayerFee: bigint = BigInt(0),
  payload: Uint8Array | null = null,
  coreBridgePackageId?: string,
  tokenBridgePackageId?: string,
) {
  if (payload !== null) {
    throw new Error('Sui transfer with payload not implemented');
  }

  const [primaryCoin, ...mergeCoins] = coins.filter((coin) =>
    isSameType(coin.coinType, coinType),
  );
  if (primaryCoin === undefined) {
    throw new Error(
      `Coins array doesn't contain any coins of type ${coinType}`,
    );
  }

  [coreBridgePackageId, tokenBridgePackageId] = await Promise.all([
    coreBridgePackageId
      ? Promise.resolve(coreBridgePackageId)
      : getPackageId(provider, coreBridgeStateObjectId),
    tokenBridgePackageId
      ? Promise.resolve(tokenBridgePackageId)
      : getPackageId(provider, tokenBridgeStateObjectId),
  ]);
  const tx = new TransactionBlock();
  const [transferCoin] = (() => {
    if (coinType === SUI_TYPE_ARG) {
      return tx.splitCoins(tx.gas, [tx.pure(amount)]);
    } else {
      const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
      if (mergeCoins.length) {
        tx.mergeCoins(
          primaryCoinInput,
          mergeCoins.map((coin) => tx.object(coin.coinObjectId)),
        );
      }

      return tx.splitCoins(primaryCoinInput, [tx.pure(amount)]);
    }
  })();
  const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure(feeAmount)]);
  const [assetInfo] = tx.moveCall({
    target: `${tokenBridgePackageId}::state::verified_asset`,
    arguments: [tx.object(tokenBridgeStateObjectId)],
    typeArguments: [coinType],
  });
  const [transferTicket, dust] = tx.moveCall({
    target: `${tokenBridgePackageId}::transfer_tokens::prepare_transfer`,
    arguments: [
      assetInfo,
      transferCoin,
      tx.pure(recipientChainId),
      tx.pure([...recipient]),
      tx.pure(relayerFee),
      tx.pure(createNonce().readUInt32LE()),
    ],
    typeArguments: [coinType],
  });
  tx.moveCall({
    target: `${tokenBridgePackageId}::coin_utils::return_nonzero`,
    arguments: [dust],
    typeArguments: [coinType],
  });
  const [messageTicket] = tx.moveCall({
    target: `${tokenBridgePackageId}::transfer_tokens::transfer_tokens`,
    arguments: [tx.object(tokenBridgeStateObjectId), transferTicket],
    typeArguments: [coinType],
  });
  tx.moveCall({
    target: `${coreBridgePackageId}::publish_message::publish_message`,
    arguments: [
      tx.object(coreBridgeStateObjectId),
      feeCoin,
      messageTicket,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}
