import { Ed25519Keypair, JsonRpcProvider, RawSigner } from "@mysten/sui.js";
import {
  Network,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
  encoding,
} from "@wormhole-foundation/connect-sdk";
import { SuiPlatform } from "./platform";
import { SuiChains } from "./types";
import { SuiUnsignedTransaction } from "./unsignedTransaction";

export async function getSuiSigner(rpc: JsonRpcProvider, privateKey: string): Promise<Signer> {
  const [network, chain] = await SuiPlatform.chainFromRpc(rpc);

  const rawSigner = new RawSigner(
    Ed25519Keypair.deriveKeypair(privateKey, "m/44'/784'/0'/0'/0'"),
    rpc,
  );

  return new SuiSigner<typeof network, typeof chain>(
    chain,
    await rawSigner.getAddress(),
    rawSigner,
  );
}

// SuiSigner implements SignOnlySender
export class SuiSigner<N extends Network, C extends SuiChains> implements SignOnlySigner<N, C> {
  constructor(
    private _chain: C,
    private _address: string,
    private _signer: RawSigner,
  ) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._address;
  }

  async sign(txns: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signedTxns: SignedTx[] = [];
    for (const tx of txns) {
      const { description, transaction } = tx as SuiUnsignedTransaction<N, C>;
      console.log(`Signing ${description} for ${this.address()}`);
      console.log(transaction);
      const gas = await this._signer.getGasCostEstimation({ transactionBlock: transaction });
      transaction.setGasBudget(gas);
      const signed = await this._signer.signTransactionBlock({ transactionBlock: transaction });
      signedTxns.push({
        signature: signed.signature,
        transactionBlock: encoding.b64.decode(signed.transactionBlockBytes),
      });
    }
    return signedTxns;
  }
}
