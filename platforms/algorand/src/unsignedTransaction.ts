import {
  ChainName,
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { TransactionSignerPair } from './types';

export class AlgorandUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: TransactionSignerPair,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
