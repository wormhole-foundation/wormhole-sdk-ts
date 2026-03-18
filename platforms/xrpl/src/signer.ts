import {
  Network,
  SignedTx,
  SignAndSendSigner,
  UnsignedTransaction,
  TxHash,
} from "@wormhole-foundation/sdk-connect";
import { Client, Wallet } from "xrpl";
import { XrplChains } from "./types.js";
import { XrplPlatform } from "./platform.js";
import { XrplUnsignedTransaction } from "./unsignedTransaction.js";

export async function getXrplSigner(
  rpc: Client,
  privateKey: string,
): Promise<SignAndSendSigner<Network, XrplChains>> {
  const [network, chain] = await XrplPlatform.chainFromRpc(rpc);
  return new XrplSigner(chain, network, rpc, privateKey);
}

export class XrplSigner<N extends Network, C extends XrplChains>
  implements SignAndSendSigner<N, C>
{
  private readonly _wallet: Wallet;

  constructor(
    private _chain: C,
    _network: Network,
    private _provider: Client,
    privateKey: string,
  ) {
    this._wallet = Wallet.fromSeed(privateKey);
  }

  async signAndSend(txs: UnsignedTransaction<N, C>[]): Promise<TxHash[]> {
    if (!this._provider.isConnected()) await this._provider.connect();

    try {
      const txHashes: TxHash[] = [];
      for (const tx of txs) {
        const xrplTx = tx as XrplUnsignedTransaction<N, C>;
        const prepared = await this._provider.autofill(xrplTx.transaction);
        const signed = this._wallet.sign(prepared);
        const result = await this._provider.submitAndWait(signed.tx_blob);
        txHashes.push(result.result.hash);
      }
      return txHashes;
    } finally {
      if (this._provider.isConnected()) await this._provider.disconnect();
    }
  }

  async sign(txs: UnsignedTransaction<N, C>[]): Promise<SignedTx[]> {
    if (!this._provider.isConnected()) await this._provider.connect();

    try {
      const signedTxs: SignedTx[] = [];
      for (const tx of txs) {
        const xrplTx = tx as XrplUnsignedTransaction<N, C>;
        const prepared = await this._provider.autofill(xrplTx.transaction);
        const signed = this._wallet.sign(prepared);
        signedTxs.push(signed.tx_blob);
      }
      return signedTxs;
    } finally {
      if (this._provider.isConnected()) await this._provider.disconnect();
    }
  }

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._wallet.classicAddress;
  }
}
