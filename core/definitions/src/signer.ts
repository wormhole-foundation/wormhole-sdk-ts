import { ChainName } from "@wormhole-foundation/sdk-base";
import { UnsignedTransaction } from "./unsignedTransaction";
import { SignedTxn } from "./types";

export interface Signer {
  chain(): ChainName;
  address(): string;
  sign(tx: UnsignedTransaction[]): Promise<SignedTxn[]>;
}
