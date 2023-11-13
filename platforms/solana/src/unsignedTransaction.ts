import { Transaction } from '@solana/web3.js';
import { Network, UnsignedTransaction } from '@wormhole-foundation/connect-sdk';
import { SolanaChains } from './types';

export class SolanaUnsignedTransaction<
  N extends Network,
  C extends SolanaChains = SolanaChains,
> implements UnsignedTransaction
{
  constructor(
    readonly transaction: Transaction,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
