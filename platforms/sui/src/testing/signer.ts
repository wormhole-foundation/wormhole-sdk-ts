import {
  Chain,
  Network,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
} from "@wormhole-foundation/connect-sdk";
import { JsonRpcProvider } from "@mysten/sui.js";
import { SuiPlatform } from "../platform";

export async function getSuiSigner(rpc: JsonRpcProvider, privateKey: string): Promise<Signer> {
  const [network, chain] = await SuiPlatform.chainFromRpc(rpc);
  return new SuiSigner<typeof network, typeof chain>(chain, rpc, privateKey);
}

// SuiSigner implements SignOnlySender
export class SuiSigner<N extends Network, C extends Chain> implements SignOnlySigner<N, C> {
  constructor(
    private _chain: C,
    _rpc: JsonRpcProvider,
    privateKey: string,
  ) {}

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
