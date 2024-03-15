import type { Keypair, Transaction } from '@solana/web3.js';
import type {
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import type { SolanaChains } from './types.js';

export type SolanaTransaction = {
  transaction: Transaction;
  signers?: Keypair[];
};

export class SolanaUnsignedTransaction<
  N extends Network,
  C extends SolanaChains = SolanaChains,
> implements UnsignedTransaction
{
  constructor(
    readonly transaction: SolanaTransaction,
    readonly network: N,
    readonly chain: C,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
