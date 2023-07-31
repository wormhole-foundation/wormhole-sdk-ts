import { Types } from 'aptos';
import { ChainId, createNonce } from '@wormhole-foundation/connect-sdk';
import { isValidAptosType } from './utils';

export const transferTokens = (
  tokenBridgeAddress: string,
  fullyQualifiedType: string,
  amount: string,
  recipientChainId: ChainId,
  recipient: Uint8Array,
  relayerFee: string,
  nonce: number,
): Types.EntryFunctionPayload => {
  if (!tokenBridgeAddress) throw new Error('Need token bridge address.');
  if (!isValidAptosType(fullyQualifiedType)) {
    throw new Error('Invalid qualified type');
  }

  return {
    function: `${tokenBridgeAddress}::transfer_tokens::transfer_tokens_entry`,
    type_arguments: [fullyQualifiedType],
    arguments: [amount, recipientChainId, recipient, relayerFee, nonce],
  };
};

export const transferTokensWithPayload = (
  tokenBridgeAddress: string,
  fullyQualifiedType: string,
  amount: string,
  recipientChain: ChainId,
  recipient: Uint8Array,
  relayerFee: string,
  nonce: number,
  payload: string,
): Types.EntryFunctionPayload => {
  throw new Error('Transfer with payload are not yet supported in the sdk');
};

/**
 * Transfer an asset on Aptos to another chain.
 * @param tokenBridgeAddress Address of token bridge
 * @param fullyQualifiedType Full qualified type of asset to transfer
 * @param amount Amount to send to recipient
 * @param recipientChain Target chain
 * @param recipient Recipient's address on target chain
 * @param relayerFee Fee to pay relayer
 * @param payload Payload3 data, leave undefined for basic token transfers
 * @returns Transaction payload
 */
export function transferFromAptos(
  tokenBridgeAddress: string,
  fullyQualifiedType: string,
  amount: string,
  recipientChain: ChainId,
  recipient: Uint8Array,
  relayerFee: string = '0',
  payload: string = '',
): Types.EntryFunctionPayload {
  if (payload) {
    // Currently unsupported
    return transferTokensWithPayload(
      tokenBridgeAddress,
      fullyQualifiedType,
      amount,
      recipientChain,
      recipient,
      relayerFee,
      createNonce().readUInt32LE(0),
      payload,
    );
  }

  return transferTokens(
    tokenBridgeAddress,
    fullyQualifiedType,
    amount,
    recipientChain,
    recipient,
    relayerFee,
    createNonce().readUInt32LE(0),
  );
}
