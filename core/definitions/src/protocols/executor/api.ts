import type { Chain } from "@wormhole-foundation/sdk-base";
import { toChainId } from "@wormhole-foundation/sdk-base";
import type { SignedQuote, TxHash } from "../../index.js";

export enum RelayStatus {
  Pending = "pending",
  Failed = "failed",
  Unsupported = "unsupported",
  Submitted = "submitted",
  Underpaid = "underpaid",
  Aborted = "aborted",
}

export type RequestForExecution = {
  quoterAddress: `0x${string}`;
  amtPaid: string;
  dstChain: number;
  dstAddr: `0x${string}`;
  refundAddr: `0x${string}`;
  signedQuoteBytes: `0x${string}`;
  requestBytes: `0x${string}`;
  relayInstructionsBytes: `0x${string}`;
  timestamp: Date;
};

export type TxInfo = {
  txHash: string;
  chainId: number;
  blockNumber: string;
  blockTime: Date | null;
  cost: string;
};

export type RelayData = {
  id: `0x${string}`;
  txHash: string;
  chainId: number;
  status: string;
  estimatedCost: string;
  requestForExecution: RequestForExecution;
  instruction?: Request;
  txs?: TxInfo[];
  indexed_at: Date;
};

export enum RequestPrefix {
  ERM1 = "ERM1", // MM
  ERV1 = "ERV1", // VAA_V1
  ERN1 = "ERN1", // NTT_V1
  ERC1 = "ERC1", // CCTP_V1
  ERC2 = "ERC2", // CCTP_V2
}

export type Capabilities = {
  requestPrefixes: Array<keyof typeof RequestPrefix>;
  gasDropOffLimit: string;
  maxGasLimit: string;
  maxMsgValue: string; // the maximum msgValue, inclusive of the gasDropOffLimit
};

export interface CapabilitiesResponse {
  [chainId: string]: Capabilities;
}

export interface QuoteResponse {
  signedQuote: `0x${string}`;
  estimatedCost?: string;
}

export interface StatusResponse extends RelayData {
  signedQuote: SignedQuote;
  estimatedCost: string;
}

export async function fetchCapabilities(apiBaseUrl: string): Promise<CapabilitiesResponse> {
  const url = `${apiBaseUrl}/capabilities`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as CapabilitiesResponse;
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
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        srcChain: toChainId(srcChain),
        dstChain: toChainId(dstChain),
        relayInstructions,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as QuoteResponse;
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
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        txHash,
        chainId: toChainId(chain),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as StatusResponse[];
  } catch (error) {
    throw new Error(`Failed to fetch status for txHash: ${txHash}.`);
  }
}
