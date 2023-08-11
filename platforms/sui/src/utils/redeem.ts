import {
  JsonRpcProvider,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
} from '@mysten/sui.js';
import { getPackageId, getTokenCoinType, uint8ArrayToBCS } from './utils';
import { parseTokenTransferVaa } from '@wormhole-foundation/connect-sdk';

export async function redeemOnSui(
  provider: JsonRpcProvider,
  coreBridgeStateObjectId: string,
  tokenBridgeStateObjectId: string,
  transferVAA: Uint8Array,
  coreBridgePackageId?: string,
  tokenBridgePackageId?: string,
): Promise<TransactionBlock> {
  const { tokenAddress, tokenChain } = parseTokenTransferVaa(transferVAA);
  const coinType = await getTokenCoinType(
    provider,
    tokenBridgeStateObjectId,
    tokenAddress,
    tokenChain,
  );
  if (!coinType) {
    throw new Error('Unable to fetch token coinType');
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
  const [verifiedVAA] = tx.moveCall({
    target: `${coreBridgePackageId}::vaa::parse_and_verify`,
    arguments: [
      tx.object(coreBridgeStateObjectId),
      tx.pure(uint8ArrayToBCS(transferVAA)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const [tokenBridgeMessage] = tx.moveCall({
    target: `${tokenBridgePackageId}::vaa::verify_only_once`,
    arguments: [tx.object(tokenBridgeStateObjectId), verifiedVAA],
  });
  const [relayerReceipt] = tx.moveCall({
    target: `${tokenBridgePackageId}::complete_transfer::authorize_transfer`,
    arguments: [tx.object(tokenBridgeStateObjectId), tokenBridgeMessage],
    typeArguments: [coinType],
  });
  const [coins] = tx.moveCall({
    target: `${tokenBridgePackageId}::complete_transfer::redeem_relayer_payout`,
    arguments: [relayerReceipt],
    typeArguments: [coinType],
  });
  tx.moveCall({
    target: `${tokenBridgePackageId}::coin_utils::return_nonzero`,
    arguments: [coins],
    typeArguments: [coinType],
  });
  return tx;
}
