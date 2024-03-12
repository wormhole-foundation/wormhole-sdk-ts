import type { Chain, Network } from "@wormhole-foundation/sdk-base";

/**
 * An unsigned transaction is a transaction that has not been signed
 * along with details about the transaction
 */
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
