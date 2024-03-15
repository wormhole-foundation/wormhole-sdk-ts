import type {
  Network,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import {
  PlatformNativeSigner,
  chainToPlatform,
  isNativeSigner,
} from '@wormhole-foundation/sdk-connect';
import type {
  Provider,
  Signer as EthersSigner,
  TransactionRequest,
} from 'ethers';
import { Wallet } from 'ethers';
import { EvmPlatform } from './platform.js';
import type { EvmChains } from './types.js';
import { _platform } from './types.js';

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForKey(
  rpc: Provider,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await EvmPlatform.chainFromRpc(rpc);
  const _signer = new Wallet(privateKey, rpc);
  return getEvmSignerForSigner(chain, _signer);
}

// Get a SignOnlySigner for the EVM platform
export async function getEvmSignerForSigner(
  chain: EvmChains,
  signer: EthersSigner,
): Promise<Signer> {
  const address = await signer.getAddress();
  return new EvmNativeSigner(chain, address, signer);
}

export class EvmNativeSigner<N extends Network, C extends EvmChains = EvmChains>
  extends PlatformNativeSigner<EthersSigner, N, C>
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

      const t: TransactionRequest = {
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

// No type guard provided by ethers, instanceof checks will fail on even slightly different versions of ethers
function isEthersSigner(thing: any): thing is EthersSigner {
  return (
    'provider' in thing &&
    typeof thing.connect === 'function' &&
    typeof thing.getAddress === 'function' &&
    typeof thing.getNonce === 'function' &&
    typeof thing.populateCall === 'function' &&
    typeof thing.populateTransaction === 'function' &&
    typeof thing.estimateGas === 'function' &&
    typeof thing.call === 'function' &&
    typeof thing.resolveName === 'function' &&
    typeof thing.signTransaction === 'function' &&
    typeof thing.sendTransaction === 'function' &&
    typeof thing.signMessage === 'function' &&
    typeof thing.signTypedData === 'function'
  );
}
