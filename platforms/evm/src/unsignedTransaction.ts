import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import { UnsignedTransaction } from '@wormhole-foundation/sdk-definitions';
import { TransactionRequest } from 'ethers';

export class EvmUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: TransactionRequest,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly stackable: boolean = false,
  ) {}
}
