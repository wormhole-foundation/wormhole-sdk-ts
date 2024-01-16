import { ChainName, SolanaTransactionSigner } from "@mayanfinance/swap-sdk";
import { ethers } from "ethers";
import { Transaction } from "@solana/web3.js";
import {
  Chain,
  Network,
  Signer,
  TransactionId,
  isSignOnlySigner,
} from "@wormhole-foundation/connect-sdk";
import { SolanaUnsignedTransaction } from "@wormhole-foundation/connect-sdk-solana";
import { EvmSigner } from "@wormhole-foundation/connect-sdk-evm/src/testing";
import axios from "axios";

export const NATIVE_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const chainNameMap = {
  Solana: "solana",
  Ethereum: "ethereum",
  Bsc: "bsc",
  Polygon: "polygon",
  Avalanche: "avalanche",
  Arbitrum: "arbitrum",
  Aptos: "aptos",
} as Record<Chain, ChainName>;

export const toMayanChainName = (chain: Chain) => {
  if (!chainNameMap[chain]) throw new Error(`Chain ${chain} not supported`);
  return chainNameMap[chain] as ChainName;
};

export function mayanSolanaSigner(signer: Signer): SolanaTransactionSigner {
  if (!isSignOnlySigner(signer)) throw new Error("Signer must be a SignOnlySigner");

  return async (tx: Transaction) => {
    const ust: SolanaUnsignedTransaction<"Mainnet"> = {
      transaction: { transaction: tx },
      description: "Mayan.InitiateSwap",
      network: "Mainnet",
      chain: "Solana",
      parallelizable: false,
    };
    const signed = (await signer.sign([ust])) as Buffer[];
    return Transaction.from(signed[0]!);
  };
}

export function mayanEvmSigner(signer: Signer): ethers.Signer {
  if (!isSignOnlySigner(signer)) throw new Error("Signer must be a SignOnlySigner");
  const w = (signer as EvmSigner<Network>)._wallet;
  // @ts-ignore
  return w as ethers.Signer;
}

export interface TransactionStatus {
  id: string;
  trader: string;
  sourceTxHash: string;
  sourceTxBlockNo: number;
  status: string;
  transferSequence: any;
  swapSequence: any;
  redeemSequence: any;
  refundSequence: any;
  fulfillSequence: any;
  deadline: string;
  sourceChain: string;
  swapChain: string;
  destChain: string;
  destAddress: string;
  fromTokenAddress: string;
  fromTokenChain: string;
  fromTokenSymbol: string;
  fromAmount: string;
  fromAmount64: any;
  toTokenAddress: string;
  toTokenChain: string;
  toTokenSymbol: string;
  stateAddr: string;
  stateNonce: string;
  toAmount: any;
  transferSignedVaa: any;
  swapSignedVaa: any;
  redeemSignedVaa: any;
  refundSignedVaa: any;
  fulfillSignedVaa: any;
  savedAt: string;
  initiatedAt: string;
  completedAt: string;
  insufficientFees: boolean;
  retries: number;
  swapRelayerFee: string;
  redeemRelayerFee: string;
  refundRelayerFee: string;
  statusUpdatedAt: string;
  syncRequestedAt: any;
  bridgeFee: string;
  redeemTxHash: any;
  refundTxHash: any;
  fulfillTxHash: any;
  auctionAddress: string;
  unwrapRedeem: boolean;
  unwrapRefund: boolean;
  driverAddress: string;
  posAddress: string;
  mayanAddress: string;
  referrerAddress: string;
  unlockRecipient: any;
  gasDrop: string;
  gasDrop64: any;
  payloadId: number;
  orderHash: any;
  randomKey: any;
  auctionStateAddr: any;
  auctionStateNonce: any;
  minAmountOut: any;
  minAmountOut64: any;
  service: string;
  refundAmount: string;
  fromTokenLogoUri: string;
  toTokenLogoUri: string;
  fromTokenScannerUrl: string;
  toTokenScannerUrl: string;
  txs: Tx[];
}

export interface Tx {
  txHash: string;
  goals: string[];
  scannerUrl: string;
}

export async function getTransactionStatus(tx: TransactionId): Promise<TransactionStatus | null> {
  const url = `https://explorer-api.mayan.finance/v3/swap/trx/${tx.txid}`;
  try {
    const response = await axios.get<TransactionStatus>(url);
    if (response.data.id) return response.data;
  } catch (error) {
    if (!error) return null;
    if (typeof error === "object") {
      // A 404 error means the VAA is not yet available
      // since its not available yet, we return null signaling it can be tried again
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      if ("status" in error && error.status === 404) return null;
    }
    throw error;
  }
  return null;
}
