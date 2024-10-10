import type { Chain, TokenAddress } from '@wormhole-foundation/sdk-connect';
import {
  encoding,
  isNative,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import axios from 'axios';

export const RELAYER_FEE_API_URL =
  'https://gfx.relayers.xlabs.xyz/api/v1/swap/quote';

export interface RelayerQuoteResponse {
  fee: string;
  validUntil: string;
}

export class PorticoApi {
  static async quoteRelayer<C extends Chain>(
    chain: Chain,
    from: TokenAddress<C>,
    to: TokenAddress<C>,
  ): Promise<bigint> {
    if (isNative(from) || isNative(to))
      throw new Error('how did you get here tho?');

    const sourceToken = encoding.hex.encode(
      from.toUniversalAddress().toUint8Array(),
      false,
    );

    const targetToken = encoding.hex.encode(
      to.toUniversalAddress().toUint8Array(),
      false,
    );

    const targetChain = toChainId(chain);

    const request = { targetChain, sourceToken, targetToken };
    try {
      const response = await axios.post<RelayerQuoteResponse>(
        RELAYER_FEE_API_URL,
        request,
      );
      return BigInt(response.data.fee);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        throw new Error(`Error getting relayer fee: ${e.response?.statusText}`);
      }
      throw e;
    }
  }
}
