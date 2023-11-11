import {
  Chain,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
  Network,
} from '@wormhole-foundation/connect-sdk';
import { ethers } from 'ethers';
import { EvmPlatform } from '../platform';

// Get a SignOnlySigner for the EVM platform
export async function getEvmSigner(
  rpc: ethers.Provider,
  privateKey: string,
): Promise<Signer> {
  const [network, chain] = await EvmPlatform.chainFromRpc(rpc);
  return new EvmSigner<typeof network, typeof chain>(chain, rpc, privateKey);
}

// EvmSigner implements SignOnlySender
export class EvmSigner<N extends Network, C extends Chain>
  implements SignOnlySigner<N, C>
{
  _wallet: ethers.Wallet;

  constructor(
    private _chain: C,
    private provider: ethers.Provider,
    privateKey: string,
  ) {
    this._wallet = new ethers.Wallet(privateKey, provider);
  }

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._wallet.address;
  }

  async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signed = [];

    let nonce = await this.provider.getTransactionCount(this.address());

    // TODO: Better gas estimation/limits
    let gasLimit = 500_000n;
    let maxFeePerGas = 1_500_000_000n; // 1.5gwei
    let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei

    // Celo does not support this call
    if (this._chain !== 'Celo') {
      const feeData = await this.provider.getFeeData();
      maxFeePerGas = feeData.maxFeePerGas ?? maxFeePerGas;
      maxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas ?? maxPriorityFeePerGas;
    }

    for (const txn of tx) {
      const { transaction, description } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      const t: ethers.TransactionRequest = {
        ...transaction,
        ...{
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce,
        },
      };

      // TODO
      // const estimate = await this.provider.estimateGas(t)
      // t.gasLimit = estimate

      signed.push(await this._wallet.signTransaction(t));

      nonce += 1;
    }
    return signed;
  }
}
