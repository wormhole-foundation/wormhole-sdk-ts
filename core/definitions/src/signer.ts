import { ChainName } from "@wormhole-foundation/sdk-base";
import { UnsignedTransaction } from "./unsignedTransaction";
import { SignedTxn } from "./types";

// TODO: move to definitions? Genericize
export interface Signer {
  chain(): ChainName;
  address(): string;
  sign(tx: UnsignedTransaction[]): Promise<SignedTxn[]>;
}
