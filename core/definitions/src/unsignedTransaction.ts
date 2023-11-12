import { Chain, Network } from "@wormhole-foundation/sdk-base";

export interface UnsignedTransaction<N extends Network = Network, C extends Chain = Chain> {
  readonly transaction: any;
  readonly network: N;
  readonly chain: C;
  readonly description: string;
  // parallelizable describes whether or not the transaction can be
  // executed in parallel with others.
  // If order matters, this will be false to ensure ordered execution
  readonly parallelizable: boolean;
}
