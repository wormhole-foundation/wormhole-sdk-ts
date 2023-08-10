import { AptosClient, Types } from 'aptos';
import { MAINNET_CHAINS, ChainId } from '@wormhole-foundation/connect-sdk';
import {
  getAssetFullyQualifiedType,
  getTypeFromExternalAddress,
} from './utils.js';
import { _parseVAAAlgorand } from './vaa.js';

export const completeTransferAndRegister = async (
  client: AptosClient,
  tokenBridgeAddress: string,
  transferVAA: Uint8Array,
): Promise<Types.EntryFunctionPayload> => {
  if (!tokenBridgeAddress) throw new Error('Need token bridge address.');

  const parsedVAA = _parseVAAAlgorand(transferVAA);
  if (!parsedVAA.FromChain || !parsedVAA.Contract || !parsedVAA.ToChain) {
    throw new Error('VAA does not contain required information');
  }

  if (parsedVAA.ToChain !== MAINNET_CHAINS.aptos) {
    throw new Error('Transfer is not destined for Aptos');
  }

  // assertChain(parsedVAA.FromChain);
  const assetType =
    parsedVAA.FromChain === MAINNET_CHAINS.aptos
      ? await getTypeFromExternalAddress(
          client,
          tokenBridgeAddress,
          parsedVAA.Contract,
        )
      : getAssetFullyQualifiedType(
          tokenBridgeAddress,
          parsedVAA.FromChain as ChainId,
          parsedVAA.Contract,
        );
  if (!assetType) throw new Error('Invalid asset address.');

  return {
    function: `${tokenBridgeAddress}::complete_transfer::submit_vaa_and_register_entry`,
    type_arguments: [assetType],
    arguments: [transferVAA],
  };
};

/**
 * Register the token specified in the given VAA in the transfer recipient's account if necessary
 * and complete the transfer.
 * @param client Client used to transfer data to/from Aptos node
 * @param tokenBridgeAddress Address of token bridge
 * @param transferVAA Bytes of transfer VAA
 * @returns Transaction payload
 */
export function redeemOnAptos(
  client: AptosClient,
  tokenBridgeAddress: string,
  transferVAA: Uint8Array,
): Promise<Types.EntryFunctionPayload> {
  return completeTransferAndRegister(client, tokenBridgeAddress, transferVAA);
}
