import { Transaction } from '@solana/web3.js';

export function logTxDetails(transaction: Transaction) {
  console.log(transaction.signatures);
  console.log(transaction.feePayer);
  transaction.instructions.forEach((ix) => {
    console.log('Program', ix.programId.toBase58());
    console.log('Data: ', ix.data.toString('hex'));
    console.log(
      'Keys: ',
      ix.keys.map((k) => [k, k.pubkey.toBase58()]),
    );
  });
}
