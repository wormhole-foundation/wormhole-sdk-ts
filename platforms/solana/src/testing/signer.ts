import { Keypair } from '@solana/web3.js';
import {
  ChainName,
  RpcConnection,
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
  encoding,
} from '@wormhole-foundation/connect-sdk';
import { SolanaPlatform } from '../platform';

// returns a SignOnlySigner for the Solana platform
export async function getSolanaSigner(
  rpc: RpcConnection<'Solana'>,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);
  return new SolanaSigner(
    chain,
    Keypair.fromSecretKey(encoding.b58.decode(privateKey)),
  );
}

export class SolanaSigner implements SignOnlySigner {
  constructor(private _chain: ChainName, private _keypair: Keypair) {}

  chain(): ChainName {
    return this._chain;
  }

  address(): string {
    return this._keypair.publicKey.toBase58();
  }

  async sign(tx: UnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      transaction.partialSign(this._keypair);
      signed.push(transaction.serialize());

      // Uncomment for debug
      // const st = transaction as Transaction;
      // console.log(st.signatures);
      // console.log(st.feePayer);
      // st.instructions.forEach((ix) => {
      //     console.log("Program", ix.programId.toBase58());
      //     console.log("Data: ", ix.data.toString("hex"));
      //     ix.keys.forEach((k) => {
      //         console.log(k.pubkey.toBase58());
      //     });
      // });
    }
    return signed;
  }
}
