import { Keypair } from '@solana/web3.js';
import { ChainName } from '@wormhole-foundation/sdk-base';
import { Signer } from '@wormhole-foundation/sdk-definitions';
import { SolanaUnsignedTransaction } from '../../src';

export class MockSolanaSigner implements Signer {
  readonly keypair: Keypair;

  constructor(kp?: Keypair) {
    this.keypair = kp ? kp : Keypair.generate();
  }

  chain(): ChainName {
    return 'Solana';
  }

  address(): string {
    return this.keypair.publicKey.toBase58();
  }

  async sign(tx: SolanaUnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const t of tx) {
      const { description, transaction } = t;

      console.log(
        `Signing: ${description} for ${this.keypair.publicKey.toBase58()}`,
      );

      transaction.partialSign(this.keypair);
      signed.push(transaction.serialize());
    }
    return signed;
  }
}
