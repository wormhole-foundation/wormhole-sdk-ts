import { Connection, Keypair } from '@solana/web3.js';
import {
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
  encoding,
} from '@wormhole-foundation/connect-sdk';
import { Network } from '@wormhole-foundation/sdk-base/src';
import { SolanaPlatform } from '../platform';
import { SolanaChains } from '../types';

// returns a SignOnlySigner for the Solana platform
export async function getSolanaSigner(
  rpc: Connection,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);
  return new SolanaSigner(
    chain,
    Keypair.fromSecretKey(encoding.b58.decode(privateKey)),
  );
}

export class SolanaSigner<N extends Network, C extends SolanaChains = 'Solana'>
  implements SignOnlySigner<N, C>
{
  constructor(
    private _chain: C,
    private _keypair: Keypair,
  ) {}

  chain(): C {
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
