import algosdk, { Account } from 'algosdk';
import {
  ChainName,
  RpcConnection,
  SignOnlySigner,
  Signer,
} from '@wormhole-foundation/connect-sdk';
import { AlgorandUnsignedTransaction } from '../unsignedTransaction';
import { AlgorandPlatform } from '../platform';

// TODO: Add alternative signer from `privateKey: string` ALGORAND_PRIVATE_KEY
export async function getAlgorandSigner(
  rpc: RpcConnection<'Algorand'>,
  mnemonic: string,
): Promise<Signer> {
  const [_, chain] = await AlgorandPlatform.chainFromRpc(rpc);
  return new AlgorandSigner(chain, algosdk.mnemonicToSecretKey(mnemonic));
}

export class AlgorandSigner implements SignOnlySigner {
  constructor(private _chain: ChainName, private _account: Account) {}

  chain(): ChainName {
    return this._chain;
  }

  address(): string {
    return this._account.addr;
  }

  async sign(txns: AlgorandUnsignedTransaction[]): Promise<any[]> {
    // Based on the pattern followed by:
    // https://github.com/barnjamin/wormhole-demo/blob/bf02d23558a5271d14bc94c2902bff899b982e86/src/wormhole/chains/algorand.ts#L270

    // Signer empty, take just tx
    const txs = txns.map((tx) => {
      return tx.transaction;
    });

    // Group txns atomically
    algosdk.assignGroupID(txs);

    // If it came with a signer, use it
    const signedTxns: Uint8Array[] = await Promise.all(
      txns.map(async (tx) => {
        if (tx.signer) {
          console.log(
            `Signing: ${tx.transaction.txID()} for ${tx.signer.addr}`,
          );
          return await tx.signer.signTxn(tx.transaction);
        } else {
          console.log(
            `Signing: ${tx.transaction.txID()} for ${this._account.addr}`,
          );
          return await tx.transaction.signTxn(this._account.sk);
        }
      }),
    );

    return signedTxns;
  }
}
