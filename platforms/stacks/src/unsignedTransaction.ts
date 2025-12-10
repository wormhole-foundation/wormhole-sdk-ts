import type {
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import type { ContractCallOptions } from '@stacks/transactions';
import type { StacksChains } from './types.js';

/**
 * An unsigned transaction for the Stacks platform
 */
export class StacksUnsignedTransaction<
  N extends Network,
  C extends StacksChains,
> implements UnsignedTransaction<N, C>
{
  constructor(
    readonly transaction: ContractCallOptions,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
