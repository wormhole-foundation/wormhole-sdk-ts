import { ChainName, Network } from "@wormhole-foundation/sdk-base";

export interface UnsignedTransaction {
  readonly transaction: any;
  readonly network: Network;
  readonly chain: ChainName;
  readonly description: string;
  readonly stackable: boolean;
}
