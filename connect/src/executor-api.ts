import { type Chain, toChainId } from "@wormhole-foundation/sdk-base";
import type {
  CapabilitiesResponse,
  QuoteResponse,
  StatusResponse,
  TxHash,
} from "@wormhole-foundation/sdk-definitions";
import axios from "axios";


export async function fetchCapabilities(apiBaseUrl: string): Promise<CapabilitiesResponse> {
  const url = `${apiBaseUrl}/capabilities`;
  try {
    const response = await axios.get<CapabilitiesResponse>(url);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch capabilities.");
  }
}

export async function fetchQuote(
  apiBaseUrl: string,
  srcChain: Chain,
  dstChain: Chain,
  relayInstructions: string,
): Promise<QuoteResponse> {
  const url = `${apiBaseUrl}/quote`;
  try {
    const response = await axios.post<QuoteResponse>(url, {
      srcChain: toChainId(srcChain),
      dstChain: toChainId(dstChain),
      relayInstructions,
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch signed quote.`);
  }
}

export async function fetchStatus(
  apiBaseUrl: string,
  txHash: TxHash,
  chain: Chain,
): Promise<StatusResponse[]> {
  const url = `${apiBaseUrl}/status/tx`;
  try {
    const response = await axios.post<StatusResponse[]>(url, {
      txHash,
      chainId: toChainId(chain),
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch status for txHash: ${txHash}.`);
  }
}
