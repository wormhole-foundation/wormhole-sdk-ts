import {
  MapLevel,
  Chain,
  constMap,
  Network,
} from '@wormhole-foundation/sdk-connect';
import { Contract, TransactionRequest, ZeroHash } from 'ethers';

const bundler3Contracts = [
  ['Mainnet', [['Polygon', '0x2d9C3A9E67c966C711208cc78b34fB9E9f8db589']]],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;

export const bundler3Contract = constMap(bundler3Contracts);

export interface Call {
  to: string;
  data: string;
  value: bigint;
  skipRevert: boolean;
  callbackHash: string; // bytes32
}

/**
 * Populates a transaction request with a multicall to the bundler3 contract
 * @param calls - Array of calls to be made in the multicall
 * @param bundler3Address - Address of the bundler3 contract
 * @returns Promise<TransactionRequest>
 *
 * See: https://docs.morpho.org/bundlers/tutorials/bundler3-solidity
 */
export async function populateMulticallTx(
  calls: Call[],
  bundler3Address: string,
): Promise<TransactionRequest> {
  if (calls.length === 0) {
    throw new Error('No transactions provided');
  }

  if (!bundler3Address) {
    throw new Error('bundler3 address required');
  }

  const bundler3 = new Contract(bundler3Address, [
    'function multicall((address to, bytes data, uint256 value, bool skipRevert, bytes32 callbackHash)[]) external payable',
  ]);

  const tx = await bundler3.getFunction('multicall').populateTransaction(calls);

  tx.value = calls.reduce((acc, tx) => acc + tx.value, 0n);

  return tx;
}

export function txReqToCall(
  tx: TransactionRequest,
  skipRevert = false,
  callbackHash = ZeroHash,
): Call {
  if (!tx.to) throw new Error('Invalid transaction: to required');

  if (typeof tx.to !== 'string')
    throw new Error('Invalid transaction: to must be a string');

  if (!tx.data) throw new Error('Invalid transaction: data required');

  return {
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value ?? 0n),
    skipRevert,
    callbackHash,
  };
}
