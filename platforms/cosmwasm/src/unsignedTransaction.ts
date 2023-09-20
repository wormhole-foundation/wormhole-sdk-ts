import { EncodeObject } from "@cosmjs/proto-signing";
import { StdFee } from "@cosmjs/stargate";
import {
  UnsignedTransaction,
  ChainName,
  Network,
} from "@wormhole-foundation/connect-sdk";

export interface CosmwasmTransaction {
  fee: StdFee | "auto" | number;
  msgs: EncodeObject[];
  memo: string;
}

export class CosmwasmUnsignedTransaction implements UnsignedTransaction {
  constructor(
    readonly transaction: CosmwasmTransaction,
    readonly network: Network,
    readonly chain: ChainName,
    readonly description: string,
    readonly parallelizable: boolean = false
  ) {}
}
