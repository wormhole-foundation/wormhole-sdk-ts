import { Keypair, Transaction } from '@solana/web3.js';
import { Network, UnsignedTransaction } from '@wormhole-foundation/connect-sdk';
import { SolanaChains } from './types';

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
