import { Transaction } from '@solana/web3.js';
import {
  ChainName,
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';

export class SolanaUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: Transaction,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
