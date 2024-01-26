import {
  Network,
  PlatformNativeSigner,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
  chainToPlatform,
  isNativeSigner,
} from '@wormhole-foundation/connect-sdk';
import { ethers } from 'ethers';
import { EvmPlatform } from './platform';
import { EvmChains, _platform } from './types';

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForKey(
  rpc: ethers.Provider,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await EvmPlatform.chainFromRpc(rpc);
  const _signer = new ethers.Wallet(privateKey, rpc);
  return getEvmSignerForSigner(chain, _signer);
}

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForSigner(
  chain: EvmChains,
  signer: ethers.Signer,
): Promise<Signer> {
  const address = await signer.getAddress();
  return new EvmNativeSigner(chain, address, signer);
}

export class EvmNativeSigner<N extends Network, C extends EvmChains = EvmChains>
  extends PlatformNativeSigner<ethers.Signer, N, C>
  implements SignOnlySigner<N, C>
{
  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._address;
  }

  async sign(tx: UnsignedTransaction<N, C>[]): Promise<SignedTx[]> {
    const signed = [];

    let nonce = await this._signer.getNonce();

    // TODO: Better gas estimation/limits
    let gasLimit = 500_000n;
    let maxFeePerGas = 1_500_000_000n; // 1.5gwei
    let maxPriorityFeePerGas = 100_000_000n; // 0.1gwei

    // Celo does not support this call
    if (this.chain() !== 'Celo') {
      const feeData = await this._signer.provider!.getFeeData();
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

      signed.push(await this._signer.signTransaction(t));

      nonce += 1;
    }
    return signed;
  }
}

export function isEvmNativeSigner<N extends Network>(
  signer: Signer<N>,
): signer is EvmNativeSigner<N> {
  return (
    isNativeSigner(signer) &&
    chainToPlatform(signer.chain()) === _platform &&
    isEthersSigner(signer.unwrap())
  );
}

function isEthersSigner(thing: any): thing is ethers.Signer {
  return thing instanceof ethers.AbstractSigner;
}
