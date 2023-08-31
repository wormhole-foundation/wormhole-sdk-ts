import { Transaction } from '@solana/web3.js';
import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import { UnsignedTransaction } from '@wormhole-foundation/sdk-definitions';

export class SolanaUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: Transaction,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
