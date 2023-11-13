import { Transaction } from 'algosdk';
import {
  ChainName,
  Network,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';

// TODO: Temporary workaround to move code from the `wormhole-sdk`
export type Signer = {
  addr: string;
  signTxn(txn: Transaction): Promise<Uint8Array>;
};

export class AlgorandUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: Transaction,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false,
    readonly signer: Signer | null = null,
  ) {}
}
