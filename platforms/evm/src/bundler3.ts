import {
  MapLevel,
  Chain,
  constMap,
  Network,
} from '@wormhole-foundation/sdk-connect';
import { Contract, TransactionRequest, ZeroHash } from 'ethers';

const bundler3Contracts = [
  [
    'Mainnet',
    [
      ['Arbitrum', '0x1FA4431bC113D308beE1d46B0e98Cb805FB48C13'],
      ['Base', '0x6BFd8137e702540E7A42B74178A4a49Ba43920C4'],
      ['Ethereum', '0x6566194141eefa99Af43Bb5Aa71460Ca2Dc90245'],
      ['Optimism', '0xFBCd3C258feB131D8E038F2A3a670A7bE0507C05'],
      ['Polygon', '0x2d9C3A9E67c966C711208cc78b34fB9E9f8db589'],
      ['Scroll', '0x60F9159d4dCd724e743212416FD57d8aC0B60768'],
      ['Unichain', '0x7DD85759182495AF7F6757DA75036d24A9B58bc3'],
      ['Worldchain', '0x3D07BF2FFb23248034bF704F3a4786F1ffE2a448'],
    ],
  ],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;

export const bundler3Contract = constMap(bundler3Contracts);

/**
 * Represents the data required to make a call.
 *
 * @property to - The target address for the call.
 * @property data - The calldata to be sent with the call.
 * @property value - The amount of native currency (in wei) to send with the call.
 * @property skipRevert - If true, the execution of other planned calls will continue even if this call reverts.
 *                        Note: `skipRevert` will ignore all reverts. Use with caution.
 * @property callbackHash - The hash of the reenter bundle data, required if the call triggers a reentrant operation.
 */
export interface Call {
  to: string;
  data: string;
  value: bigint;
  skipRevert: boolean;
  callbackHash: string;
}

/**
 * Populates a transaction request with a call to the bundler3 multicall function
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
