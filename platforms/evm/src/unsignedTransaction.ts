import {
  UnsignedTransaction,
  Chain,
  Network,
} from '@wormhole-foundation/connect-sdk';
import { TransactionRequest } from 'ethers';

export class EvmUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: TransactionRequest,
    readonly network: Network,
    readonly chain: Chain,
    readonly description: string,
    readonly parallelizable: boolean = false,
  ) {}
}
