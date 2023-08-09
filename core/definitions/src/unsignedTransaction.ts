import { ChainName, Network } from "@wormhole-foundation/sdk-base";

export interface UnsignedTransaction {
  readonly transacion: any;
  readonly network: Network;
  readonly chain: ChainName;
  readonly description: string;
  readonly stackable: boolean;
}
