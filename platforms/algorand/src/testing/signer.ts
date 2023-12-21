import {
  Chain,
  Network,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
} from "@wormhole-foundation/connect-sdk";
import { Algodv2 } from "algosdk";
import { AlgorandPlatform } from "../platform";

export async function getAlgorandSigner(rpc: Algodv2, privateKey: string): Promise<Signer> {
  const [network, chain] = await AlgorandPlatform.chainFromRpc(rpc);
  return new AlgorandSigner<typeof network, typeof chain>(chain, rpc, privateKey);
}

// AlgorandSigner implements SignOnlySender
export class AlgorandSigner<N extends Network, C extends Chain> implements SignOnlySigner<N, C> {
  constructor(private _chain: C, _rpc: Algodv2, privateKey: string) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    return "";
  }

  async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
    throw new Error("Not implemented");
  }
}
