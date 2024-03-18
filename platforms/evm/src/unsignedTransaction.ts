import type {
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import type { TransactionRequest } from 'ethers';
import type { EvmChains } from './types.js';

/**
 * An unsigned transaction for the EVM platform
 */
export class EvmUnsignedTransaction<N extends Network, C extends EvmChains>
  implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: TransactionRequest,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
