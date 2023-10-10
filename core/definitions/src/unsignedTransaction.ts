import { ChainName, Network } from "@wormhole-foundation/sdk-base";

export interface UnsignedTransaction {
  readonly transaction: any;
  readonly network: Network;
  readonly chain: ChainName;
  readonly description: string;
  // parallelizable describes whether or not the transaction can be
  // executed in parallel with others.
  // If order matters, this will be false to ensure ordered execution
  readonly parallelizable: boolean;
}
