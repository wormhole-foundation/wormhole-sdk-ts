import { Transaction } from 'algosdk';
import {
  ChainName,
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';

export class AlgorandUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: Transaction,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
